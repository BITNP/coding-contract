const CACHE = `pioneer-lsp-${new URL(location.href).searchParams.get('v')}`
const ASSET = /\.(wasm|data|index)$|clangd-runtime|pyright\.worker|ts\.worker/

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  const stale = caches.keys().then((keys) => keys.filter((key) => key.startsWith('pioneer-lsp-') && key !== CACHE))
  event.waitUntil(stale.then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || request.headers.has('range') || !ASSET.test(new URL(request.url).pathname)) return
  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) => cache.match(request.url))
      .then((hit) => hit || fetch(request)),
  )
})
