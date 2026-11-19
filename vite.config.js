import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { brotliCompress, constants, gzip } from 'node:zlib'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { assetService } from './public/lsp-assets.js'

const monacoLsp = fileURLToPath(
  new URL('node_modules/monaco-editor/esm/external/monaco-lsp-client/out/index.js', import.meta.url),
)
const tsPackages = JSON.parse(readFileSync(new URL('./src/lsp/typescript/package.json', import.meta.url))).dependencies
const versionOf = (name) =>
  JSON.parse(readFileSync(new URL(`node_modules/${name}/package.json`, import.meta.url))).version
const lspVersions = {
  clangd: versionOf('@algoproclub/clangd-wasm'),
  python: versionOf('browser-basedpyright'),
  typescript: [versionOf('monaco-editor'), ...Object.values(tsPackages)].join('_'),
}

const sandboxTypeScript = () => ({
  name: 'sandbox-typescript',
  enforce: 'pre',
  resolveId(id, importer) {
    if (importer?.includes('/monaco-editor/esm/vs/languages/features/typescript/') && /^\.\/lib\/(typescriptServices|lib)\.js$/.test(id))
      return fileURLToPath(new URL('./src/lsp/typescript/worker-libs.js', import.meta.url))
  },
})

const brotliAsync = promisify(brotliCompress)
const gzipAsync = promisify(gzip)
const precompressLanguageAssets = {
  name: 'precompress-language-assets',
  apply: 'build',
  enforce: 'post',
  async generateBundle(_options, bundle) {
    const assets = Object.values(bundle).filter(({ fileName }) => assetService('/' + fileName))
    await Promise.all(
      assets.map(async (asset) => {
        const source = asset.type === 'asset' ? asset.source : asset.code
        const [br, gz] = await Promise.all([
          brotliAsync(source, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }),
          gzipAsync(source, { level: 6 }),
        ])
        this.emitFile({ type: 'asset', fileName: asset.fileName + '.br', source: br })
        this.emitFile({ type: 'asset', fileName: asset.fileName + '.gz', source: gz })
      }),
    )
  },
}

export default defineConfig(({ mode }) => ({
  plugins: [vue(), sandboxTypeScript(), precompressLanguageAssets],
  define: { __LSP_VERSIONS__: JSON.stringify(lspVersions) },
  resolve: { alias: { 'monaco-lsp-client': monacoLsp } },
  optimizeDeps: {
    exclude: ['@algoproclub/clangd-wasm'],
    include: ['monaco-lsp-client', '@algoproclub/clangd-wasm > vscode-jsonrpc/lib/common/messages.js'],
  },
  server: { proxy: { '/api': loadEnv(mode, process.cwd()).VITE_API_PROXY || 'http://127.0.0.1:3001' } },
  worker: { plugins: () => [sandboxTypeScript()], rollupOptions: { output: { assetFileNames: '[name][extname]' } } },
  build: {
    rollupOptions: {
      output: { entryFileNames: 'app.js', chunkFileNames: '[name].js', assetFileNames: '[name][extname]' },
    },
  },
}))
