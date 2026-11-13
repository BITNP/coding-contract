import { shallowRef } from 'vue'
import { fetchAssets, registerAssetCache } from './assets.js'

const services = {
  c: () => import('./clangd.js'),
  cpp: () => import('./clangd.js'),
  python: () => import('./python.js'),
  javascript: () => import('./typescript.js'),
  typescript: () => import('./typescript.js'),
}

export const lspStatus = shallowRef({ state: 'none', progress: 0 })
const cacheReady = registerAssetCache()
let current = null

async function run(session) {
  const update = (status) => session === current && (lspStatus.value = status)
  update({ state: 'loading', progress: 0 })
  try {
    const service = (await services[session.language]()).default
    if (service.supported && !service.supported()) return update({ state: 'unsupported', progress: 0 })
    await cacheReady
    await fetchAssets(
      service.assets(),
      (progress) => update({ state: 'loading', progress }),
      session.abort.signal,
    )
    const stop = await service.start(session.model, session.language, session.abort.signal)
    if (session !== current) return stop()
    session.stop = stop
    update({ state: 'ready', progress: 1, name: service.name })
  } catch (error) {
    if (session.abort.signal.aborted) return
    console.warn('[lsp]', error)
    update({ state: 'error', progress: lspStatus.value.progress, message: error.message })
  }
}

export function attachLanguageService(model, language) {
  detachLanguageService()
  if (!services[language]) return (lspStatus.value = { state: 'none', progress: 0 })
  current = { model, language, abort: new AbortController() }
  run(current)
}

export function retryLanguageService() {
  if (!current || lspStatus.value.state !== 'error') return
  current.abort = new AbortController()
  run(current)
}

export function detachLanguageService() {
  if (!current) return
  current.abort.abort()
  current.stop?.()
  current = null
}
