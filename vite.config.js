import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

const monacoLsp = fileURLToPath(
  new URL('node_modules/monaco-editor/esm/external/monaco-lsp-client/out/index.js', import.meta.url),
)
// Keep responses cached before the module MIME fix out of the current asset cache.
const lspVersion = 'module-mime-v2_' + ['monaco-editor', '@algoproclub/clangd-wasm', 'browser-basedpyright']
  .map(
    (name) => JSON.parse(readFileSync(new URL(`node_modules/${name}/package.json`, import.meta.url))).version,
  )
  .join('_')

export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  define: { __LSP_VERSION__: JSON.stringify(lspVersion) },
  resolve: { alias: { 'monaco-lsp-client': monacoLsp } },
  optimizeDeps: {
    exclude: ['@algoproclub/clangd-wasm'],
    include: ['monaco-lsp-client', '@algoproclub/clangd-wasm > vscode-jsonrpc/lib/common/messages.js'],
  },
  server: { proxy: { '/api': loadEnv(mode, process.cwd()).VITE_API_PROXY || 'http://127.0.0.1:3001' } },
  worker: { rollupOptions: { output: { assetFileNames: '[name][extname]' } } },
  build: {
    rollupOptions: {
      output: { entryFileNames: 'app.js', chunkFileNames: '[name].js', assetFileNames: '[name][extname]' },
    },
  },
}))
