import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (await readFile(new URL('../src/lsp/assets.js', import.meta.url), 'utf8')).replaceAll(
  '__LSP_VERSION__',
  "'test'",
)
function mockGlobal(t, key, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, key)
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  })
}

let version = 0
const load = () => import(`data:text/javascript,${encodeURIComponent(source)}#${version++}`)
const asset = { url: 'https://example.test/clangd.wasm' }

test('cache write failure does not block startup or leave a completed range', async (t) => {
  const headers = []
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    headers.push(options.headers)
    return new Response('wasm', { headers: { etag: '"v1"' } })
  })
  mockGlobal(t, 'self', { caches: true })
  mockGlobal(t, 'caches', {
    open: async () => ({
      match: async () => undefined,
      put: async () => {
        throw new Error('quota')
      },
    }),
  })
  const { fetchAssets } = await load()
  await fetchAssets([asset], () => {}, new AbortController().signal)
  await fetchAssets([asset], () => {}, new AbortController().signal)
  assert.deepEqual(headers, [{}, {}])
})

test('a failed batch aborts and settles other downloads before retry', async (t) => {
  mockGlobal(t, 'self', {})
  let active = 0
  let calls = 0
  let aborted = false
  t.mock.method(globalThis, 'fetch', async (url, { signal }) => {
    calls++
    if (url.endsWith('bad')) throw new Error('network')
    if (calls > 2) {
      assert.equal(active, 0)
      return new Response('wasm')
    }
    active++
    return new Response(
      new ReadableStream({
        start(controller) {
          signal.addEventListener(
            'abort',
            () => {
              aborted = true
              active--
              controller.error(signal.reason)
            },
            { once: true },
          )
        },
      }),
    )
  })
  const { fetchAssets } = await load()
  await assert.rejects(
    fetchAssets([asset, { url: 'https://example.test/bad' }], () => {}, new AbortController().signal),
    /network/,
  )
  assert.equal(aborted, true)
  assert.equal(active, 0)
  await fetchAssets([asset], () => {}, new AbortController().signal)
})

test('LSP connection waits for initialization and disposes failed initialization', async (t) => {
  let resolve
  let reject
  let disposed = 0
  let initialized = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  mockGlobal(t, '__lspTest', {
    MonacoLspClient: class {
      constructor() {
        this._initPromise = initialized
        this._bridge = { _managedModels: new Map(), dispose() {} }
        this.createFeatures()
      }
      createFeatures() {
        return {
          dispose() {
            disposed++
          },
        }
      }
    },
    createTransportToWorker: () => ({ dispose() {} }),
  })
  const clientSource = (await readFile(new URL('../src/lsp/client.js', import.meta.url), 'utf8')).replace(
    "import { MonacoLspClient, createTransportToWorker } from 'monaco-lsp-client'",
    'const { MonacoLspClient, createTransportToWorker } = globalThis.__lspTest',
  )
  const { connect } = await import(`data:text/javascript,${encodeURIComponent(clientSource)}`)
  let ready = false
  const connection = connect({}, new AbortController().signal).then((client) => {
    ready = true
    return client
  })
  await Promise.resolve()
  assert.equal(ready, false)
  resolve()
  const client = await connection
  assert.equal(ready, true)
  client.dispose()
  initialized = new Promise((_yes, no) => {
    reject = no
  })
  const failed = connect({}, new AbortController().signal)
  reject(new Error('initialize failed'))
  await assert.rejects(failed, /initialize failed/)
  assert.equal(disposed, 2)
})
