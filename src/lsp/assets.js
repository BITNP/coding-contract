const partial = new Map()
let pending = Promise.resolve()

export function activeAssetCache(service) {
  const controller = navigator.serviceWorker?.controller
  return controller && new URL(controller.scriptURL).searchParams.get(service)
}

export async function registerAssetCache(cacheNames) {
  const workers = navigator.serviceWorker
  if (!workers) return false
  const url = new URL('/sw.js', location.href)
  url.search = new URLSearchParams(cacheNames).toString()
  try {
    await workers.register(url.href, { type: 'module', updateViaCache: 'none' })
    if (workers.controller?.scriptURL === url.href) return true
    return await new Promise((resolve) => {
      function finish(ready) {
        clearTimeout(timer)
        workers.removeEventListener('controllerchange', changed)
        resolve(ready)
      }
      function changed() {
        if (workers.controller?.scriptURL === url.href) finish(true)
      }
      const timer = setTimeout(() => finish(false), 3000)
      workers.addEventListener('controllerchange', changed)
    })
  } catch {
    return false
  }
}

function validator(response) {
  const etag = response.headers.get('etag')
  return etag && !etag.startsWith('W/') ? etag : response.headers.get('last-modified')
}

async function download(asset, cache, report, signal) {
  signal.throwIfAborted()
  if (await cache.match(asset.url)) return report(asset, asset.size || 1, asset.size || 1)
  const previous = partial.get(asset.url)
  const resume = previous?.loaded ? { range: `bytes=${previous.loaded}-`, 'if-range': previous.validator } : {}
  const response = await fetch(asset.url, { signal, cache: 'no-cache', headers: resume })
  const encoding = response.headers.get('content-encoding')
  const encoded = encoding && encoding !== 'identity'
  const version = encoded ? null : validator(response)
  const ranged = response.status === 206
  const range = ranged && response.headers.get('content-range')?.match(/^bytes (\d+)-(\d+)\/(\d+)$/i)
  const rangeSize = range && Number(range[3])
  if (ranged || response.status === 416) {
    const complete =
      range && previous && Number(range[1]) === previous.loaded &&
      previous.loaded < rangeSize && Number(range[2]) + 1 === rangeSize
    if (encoded || !complete || (version && version !== previous.validator)) {
      await response.body?.cancel()
      if (!partial.delete(asset.url)) throw new Error(`无效的资源区间：${asset.url}`)
      return download(asset, cache, report, signal)
    }
  }
  if (!response.ok) throw new Error(`${new URL(asset.url).pathname}: HTTP ${response.status}`)
  const part = ranged ? previous : { chunks: [], loaded: 0, validator: version }
  if (part.validator) partial.set(asset.url, part)
  else partial.delete(asset.url)
  const length = !encoded && Number(response.headers.get('content-length'))
  const total = rangeSize || asset.size || (length && part.loaded + length) || 0
  const reader = response.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    part.chunks.push(value)
    part.loaded += value.length
    report(asset, part.loaded, total)
  }
  partial.delete(asset.url)
  if (ranged && part.loaded !== rangeSize) return download(asset, cache, report, signal)
  report(asset, part.loaded, part.loaded)
  const headers = { 'content-type': response.headers.get('content-type') || 'application/octet-stream' }
  try {
    await cache.put(asset.url, new Response(new Blob(part.chunks), { headers }))
  } catch {
    // 缓存配额不足时仍可通过网络启动服务。
  }
}

export function fetchAssets(cacheName, assets, onProgress, signal) {
  pending = pending.catch(() => {}).then(() => downloadAssets(cacheName, assets, onProgress, signal))
  return pending
}

async function downloadAssets(cacheName, assets, onProgress, signal) {
  signal.throwIfAborted()
  const cache = await self.caches?.open(cacheName).catch(() => null)
  if (!cache) return onProgress(1)
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
