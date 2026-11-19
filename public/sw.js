import { assetService } from './lsp-assets.js'

const names = new URL(location.href).searchParams
const active = new Set(names.values())

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  const stale = caches
    .keys()
    .then((keys) => keys.filter((key) => key.startsWith('pioneer-lsp-') && !active.has(key)))
  event.waitUntil(
    stale.then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || request.cache === 'no-cache' || request.headers.has('range')) return
  const url = new URL(request.url)
  const name = names.get(assetService(url.pathname))
  if (!name || url.origin !== location.origin) return
  event.respondWith(
    (async () => {
      const cache = await caches.open(name).catch(() => null)
      const hit = await cache?.match(request)
      if (hit) return hit
      const response = await fetch(request)
      if (cache && response.status === 200)
        event.waitUntil(cache.put(request, response.clone()).catch(() => {}))
      return response
    })(),
  )
})
