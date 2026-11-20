import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

function mockGlobal(t, key, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, key)
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  })
}

let version = 0
function load() {
  return import(`../src/lsp/assets.js?test=${version++}`)
}
const asset = { url: 'https://example.test/clangd.wasm' }
const names = {
  clangd: 'pioneer-lsp-clangd-1',
  python: 'pioneer-lsp-python-1',
  typescript: 'pioneer-lsp-typescript-2',
}

test('cache setup waits until the new service worker controls this page', async (t) => {
  const workers = new EventTarget()
  let scriptURL
  workers.register = async (url) => {
    scriptURL = url
  }
  workers.controller = { scriptURL: 'https://example.test/sw.js?older' }
  mockGlobal(t, 'location', new URL('https://example.test/'))
  mockGlobal(t, 'navigator', { serviceWorker: workers })
  const { registerAssetCache, activeAssetCache } = await load()
  let done = false
  const ready = registerAssetCache(names).then((ok) => {
    done = ok
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(Object.fromEntries(new URL(scriptURL).searchParams), names)
  assert.equal(done, false)
  workers.controller = { scriptURL }
  workers.dispatchEvent(new Event('controllerchange'))
  await ready
  assert.equal(done, true)
  const newer = new URL(scriptURL)
  newer.searchParams.set('typescript', 'pioneer-lsp-typescript-3')
  workers.controller = { scriptURL: newer.href }
  assert.equal(activeAssetCache('typescript'), 'pioneer-lsp-typescript-3')
  assert.equal(activeAssetCache('clangd'), names.clangd)
})

test('a TS-only release keeps other language caches and routes each worker to its own cache', async (t) => {
  const origin = 'https://example.test'
  const oldTS = 'pioneer-lsp-typescript-1'
  const stored = new Set([...Object.values(names), oldTS, 'another-app'])
  const events = {}
  mockGlobal(t, 'location', new URL(`${origin}/sw.js?${new URLSearchParams(names)}`))
  mockGlobal(t, 'self', {
    addEventListener: (type, fn) => {
      events[type] = fn
    },
    clients: { claim() {} },
  })
  mockGlobal(t, 'caches', {
    keys: async () => [...stored],
    delete: async (name) => stored.delete(name),
    open: async (name) => ({ match: async () => new Response(name) }),
  })
  await import('../public/sw.js')
  await new Promise((resolve) => events.activate({ waitUntil: resolve }))
  assert.deepEqual(stored, new Set([...Object.values(names), 'another-app']))
  for (const [path, expected] of [
    ['/headers.data', names.clangd],
    ['/assets/clangd.shared-worker-X.js', names.clangd],
    ['/pyright.worker.js', names.python],
    ['/assets/ts.worker-New.js', names.typescript],
  ]) {
    let reply
    events.fetch({
      request: new Request(origin + path),
      respondWith: (response) => {
        reply = response
      },
    })
    assert.equal(await (await reply).text(), expected)
  }
})

test('cache write failure does not block startup or leave a completed range', async (t) => {
  const headers = []
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    headers.push(options.headers)
    return new Response('wasm', { headers: { etag: '"v1"' } })
  })
  mockGlobal(t, 'self', {
    caches: {
      open: async () => ({
        match: async () => undefined,
        put: async () => {
          throw new Error('quota')
        },
      }),
    },
  })
  const { fetchAssets } = await load()
  await fetchAssets(names.clangd, [asset], () => {}, new AbortController().signal)
  await fetchAssets(names.clangd, [asset], () => {}, new AbortController().signal)
  assert.deepEqual(headers, [{}, {}])
})

test('only resumes uncompressed assets at the saved byte offset', async (t) => {
  const saved = new Map()
  mockGlobal(t, 'self', {
    caches: {
      open: async () => ({ match: (url) => saved.get(url), put: (url, res) => saved.set(url, res) }),
    },
  })
  const { fetchAssets } = await load()
  let reply
  t.mock.method(globalThis, 'fetch', (url, { headers }) => reply(headers))
  const range = { range: 'bytes=2-', 'if-range': '"v1"' }
  for (const [encoding, remainder, expected] of [
    ['identity', 'cd', [range]],
    ['identity', 'c', [range, {}]],
    ['gzip', 'cd', [{}]],
  ]) {
    const item = { url: asset.url + '?' + encoding + remainder }
    const download = () => fetchAssets(names.clangd, [item], () => {}, new AbortController().signal)
    reply = () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('ab'))
          },
          pull(controller) {
            controller.error(new Error('interrupted'))
          },
        }),
        { headers: { etag: '"v1"', 'content-encoding': encoding } },
      )
    await assert.rejects(download(), /interrupted/)
    const requests = []
    reply = (headers) => {
      requests.push(headers)
      if (!headers.range) return new Response('abcd')
      return new Response(remainder, { status: 206, headers: { 'content-range': 'bytes 2-3/4' } })
    }
    await download()
    assert.deepEqual(requests, expected)
    assert.equal(await saved.get(item.url).text(), 'abcd')
  }
})

test('a failed batch aborts and settles other downloads before retry', async (t) => {
  mockGlobal(t, 'self', { caches: { open: async () => ({ match() {}, put() {} }) } })
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
    fetchAssets(
      names.clangd,
      [asset, { url: 'https://example.test/bad' }],
      () => {},
      new AbortController().signal,
    ),
    /network/,
  )
  assert.equal(aborted, true)
  assert.equal(active, 0)
  await fetchAssets(names.clangd, [asset], () => {}, new AbortController().signal)
})

test('LSP connection waits for initialization and disposes failed initialization', async (t) => {
  let init = Promise.withResolvers()
  let disposed = 0
  let released = 0
  const release = () => {
    released++
  }
  mockGlobal(t, '__lspTest', {
    MonacoLspClient: class {
      constructor() {
        this._initPromise = init.promise
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
  const connection = connect({}, new AbortController().signal, release).then((stop) => {
    ready = true
    return stop
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(ready, false)
  init.resolve()
  const stop = await connection
  stop()
  init = Promise.withResolvers()
  const failed = connect({}, new AbortController().signal, release)
  init.reject(new Error('initialize failed'))
  await assert.rejects(failed, /initialize failed/)
  await assert.rejects(connect({}, AbortSignal.abort(), release), { name: 'AbortError' })
  assert.equal(disposed, 2)
  assert.equal(released, 3)
})
