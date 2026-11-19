import { MonacoLspClient, createTransportToWorker } from 'monaco-lsp-client'

class LspClient extends MonacoLspClient {
  createFeatures() {
    this.features = super.createFeatures()
    return this.features
  }

  dispose() {
    for (const model of this._bridge._managedModels.values()) model.dispose()
    this.features.dispose()
    this._bridge.dispose()
  }
}

export async function connect(target, signal, release) {
  let transport
  let client
  let onAbort
  const stop = () => {
    try {
      client?.dispose()
    } finally {
      transport?.dispose()
      release()
    }
  }
  try {
    signal.throwIfAborted()
    transport = createTransportToWorker(target)
    client = new LspClient(transport)
    await Promise.race([
      client._initPromise,
      new Promise((_, reject) => {
        onAbort = () => reject(signal.reason)
        signal.addEventListener('abort', onAbort, { once: true })
      }),
    ])
    signal.throwIfAborted()
    return stop
  } catch (error) {
    stop()
    throw error
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort)
  }
}
