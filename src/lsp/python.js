import workerUrl from 'browser-basedpyright/dist/pyright.worker.js?url'
import { connect } from './client.js'

const workspace = { uri: 'file:///workspace/', name: 'workspace' }
const initializationOptions = {
  files: { '/workspace/pyrightconfig.json': JSON.stringify({ typeCheckingMode: 'standard' }) },
  disablePullDiagnostics: true,
}

function boot() {
  const workers = [new Worker(workerUrl, { name: 'basedpyright' })]
  workers[0].addEventListener('message', ({ data }) => {
    if (data?.type !== 'browser/newWorker') return
    const background = new Worker(workerUrl, { name: 'basedpyright-background' })
    background.postMessage(
      { type: 'browser/boot', mode: 'background', initialData: data.initialData, port: data.port },
      [data.port],
    )
    workers.push(background)
  })
  workers[0].postMessage({ type: 'browser/boot', mode: 'foreground' })
  return workers
}

function languageServerPort(worker) {
  const listeners = new Map()
  return {
    postMessage(message) {
      if (message.method === 'initialize')
        Object.assign(message.params, { workspaceFolders: [workspace], initializationOptions })
      worker.postMessage(message)
    },
    addEventListener(type, listener) {
      const filtered = (event) => event.data?.type === 'browser/newWorker' || listener(event)
      listeners.set(listener, filtered)
      worker.addEventListener(type, filtered)
    },
    removeEventListener(type, listener) {
      worker.removeEventListener(type, listeners.get(listener))
    },
  }
}

export default {
  name: 'basedpyright',
  assets: () => [{ url: new URL(workerUrl, location.href).href, size: 17982887 }],
  async start(_model, _language, signal) {
    const workers = boot()
    let client
    try {
      client = await connect(languageServerPort(workers[0]), signal)
    } catch (error) {
      workers.forEach((worker) => worker.terminate())
      throw error
    }
    return () => {
      client.dispose()
      workers.forEach((worker) => worker.terminate())
    }
  },
}
