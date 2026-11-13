import { openClangdSession } from '@algoproclub/clangd-wasm'
import { isClangdWasmSupported } from '@algoproclub/clangd-wasm/support'
import { connect } from './client.js'

const asset = (name, size) => ({
  url: new URL(`../../node_modules/@algoproclub/clangd-wasm/assets/${name}`, import.meta.url).href,
  size,
})

const standards = { c: ['-xc', '-std=c17'], cpp: ['-std=c++17'] }

export default {
  name: 'clangd',
  supported: isClangdWasmSupported,
  assets: () => [
    asset('clangd-runtime.mjs', 423830),
    asset('clangd.wasm', 27562174),
    asset('headers.data', 45246257),
    asset('system.index', 5494222),
  ],
  async start(model, language, signal) {
    const session = await openClangdSession({
      uri: model.uri.toString(true).toLowerCase(),
      compilerArguments: standards[language],
      signal,
    })
    let client
    try {
      client = await connect(session.port, signal)
    } catch (error) {
      session.dispose()
      throw error
    }
    return () => {
      client.dispose()
      session.dispose()
    }
  },
}
