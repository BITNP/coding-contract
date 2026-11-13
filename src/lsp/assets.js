const CACHE = `pioneer-lsp-${__LSP_VERSION__}`
const partial = new Map()
let pending = Promise.resolve()

const openCache = () => (self.caches ? caches.open(CACHE).catch(() => null) : Promise.resolve(null))

export function registerAssetCache() {
  if (!navigator.serviceWorker) return Promise.resolve()
  return navigator.serviceWorker
    .register(`/sw.js?v=${encodeURIComponent(__LSP_VERSION__)}`)
    .then(async (registration) => {
      const worker = registration.installing || registration.waiting
      let timer
      let stopWaiting = () => {}
      const activated = new Promise((resolve) => {
        if (!worker || worker.state === 'activated' || worker.state === 'redundant') return resolve()
        const onStateChange = () => {
          if (worker.state === 'activated' || worker.state === 'redundant') resolve()
        }
        worker.addEventListener('statechange', onStateChange)
        stopWaiting = () => worker.removeEventListener('statechange', onStateChange)
      })
      try {
        await Promise.race([
          activated.then(() => navigator.serviceWorker.ready),
          new Promise((resolve) => { timer = setTimeout(resolve, 3000) }),
        ])
      } finally {
        clearTimeout(timer)
        stopWaiting()
      }
    })
    .catch(() => {})
}

function validator(response) {
  const etag = response.headers.get('etag')
  return etag && !etag.startsWith('W/') ? etag : response.headers.get('last-modified')
}

async function download(asset, cache, report, signal) {
  signal.throwIfAborted()
  if (await cache?.match(asset.url)) return report(asset, asset.size || 1, asset.size || 1)
  const part = partial.get(asset.url) ?? { chunks: [], loaded: 0 }
  partial.set(asset.url, part)
  const resume =
    part.loaded && part.validator ? { range: `bytes=${part.loaded}-`, 'if-range': part.validator } : {}
  const response = await fetch(asset.url, { signal, cache: 'no-cache', headers: resume })
  if (!response.ok) throw new Error(`${new URL(asset.url).pathname}: HTTP ${response.status}`)
  if (response.status !== 206) Object.assign(part, { chunks: [], loaded: 0 })
  part.validator = validator(response)
  const length = !response.headers.get('content-encoding') && Number(response.headers.get('content-length'))
  const total = asset.size || (length && part.loaded + length) || 0
  const reader = response.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    part.chunks.push(value)
    part.loaded += value.length
    report(asset, part.loaded, total)
  }
  report(asset, part.loaded, part.loaded)
  const headers = { 'content-type': response.headers.get('content-type') || 'application/octet-stream' }
  partial.delete(asset.url)
  try {
    await cache?.put(asset.url, new Response(new Blob(part.chunks), { headers }))
  } catch {
    // 缓存配额不足时仍可通过网络启动服务。
  }
}

export function fetchAssets(assets, onProgress, signal) {
  pending = pending.catch(() => {}).then(() => downloadAssets(assets, onProgress, signal))
  return pending
}

async function downloadAssets(assets, onProgress, signal) {
  signal.throwIfAborted()
  const cache = await openCache()
  const state = new Map(assets.map((asset) => [asset, { loaded: 0, total: asset.size || 0 }]))
  const report = (asset, loaded, total) => {
    state.set(asset, { loaded, total: Math.max(total, loaded) })
    let done = 0
    let expected = 0
    for (const item of state.values()) {
      done += Math.min(item.loaded, item.total)
      expected += item.total
    }
    onProgress(expected ? Math.min(done / expected, 0.99) : 0)
  }
  const abort = new AbortController()
  const batchSignal = AbortSignal.any([signal, abort.signal])
  const downloads = assets.map((asset) => download(asset, cache, report, batchSignal))
  try {
    await Promise.all(downloads)
  } catch (error) {
    abort.abort()
    await Promise.allSettled(downloads)
    throw error
  }
  signal.throwIfAborted()
  onProgress(1)
}
