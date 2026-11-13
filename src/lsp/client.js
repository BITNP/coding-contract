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
    this.transport.dispose()
  }
}

export async function connect(target, signal) {
  signal.throwIfAborted()
  const transport = createTransportToWorker(target)
  const client = new LspClient(transport)
  client.transport = transport
  let onAbort
  try {
    await Promise.race([
      client._initPromise,
      new Promise((_, reject) => {
        onAbort = () => reject(signal.reason)
        signal.addEventListener('abort', onAbort, { once: true })
      }),
    ])
    signal.throwIfAborted()
    return client
  } catch (error) {
    client.dispose()
    throw error
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}
