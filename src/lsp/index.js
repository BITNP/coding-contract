import { shallowRef } from 'vue'
import { activeAssetCache, fetchAssets, registerAssetCache } from './assets.js'
import * as typescript from './typescript.js'

const loadTypeScript = () => typescript

const services = {
  c: () => import('./clangd.js'),
  cpp: () => import('./clangd.js'),
  python: () => import('./python.js'),
  javascript: loadTypeScript,
  typescript: loadTypeScript,
}

export const lspStatus = shallowRef({ state: 'none', progress: 0 })
const versions = {
  ...__LSP_VERSIONS__,
  typescript: `${__LSP_VERSIONS__.typescript}-${typescript.workerUrl.split('/').pop()}`,
}
const cacheNames = Object.fromEntries(
  Object.entries(versions).map(([service, version]) => [service, `pioneer-lsp-${service}-${version}`]),
)
const cacheReady = registerAssetCache(cacheNames)
let current = null

async function run(session) {
  const update = (status) => session === current && (lspStatus.value = status)
  update({ state: 'loading', progress: 0 })
  try {
    const service = (await services[session.language]()).default
    if (service.supported && !service.supported()) return update({ state: 'unsupported', progress: 0 })
    await cacheReady
    const cache = cacheNames[service.cache]
    if (activeAssetCache(service.cache) === cache) {
      await fetchAssets(
        cache,
        service.assets(),
        (progress) => update({ state: 'loading', progress }),
        session.abort.signal,
      )
    } else update({ state: 'loading', progress: 1 })
    session.abort.signal.throwIfAborted()
    const stop = await service.start(session.model, session.language, session.abort.signal)
    if (session !== current) return stop?.()
    session.stop = stop
    update({ state: 'ready', progress: 1 })
  } catch (error) {
    if (session.abort.signal.aborted) return
    console.warn('[lsp]', error)
    update({ state: 'error', progress: lspStatus.value.progress })
  }
}

export function attachLanguageService(model, language) {
  detachLanguageService()
  if (!services[language]) return
  current = { model, language, abort: new AbortController() }
  run(current)
}

export function retryLanguageService() {
  if (current && lspStatus.value.state === 'error') attachLanguageService(current.model, current.language)
}

export function detachLanguageService() {
  lspStatus.value = { state: 'none', progress: 0 }
  if (!current) return
  current.abort.abort()
  current.stop?.()
  current = null
}
