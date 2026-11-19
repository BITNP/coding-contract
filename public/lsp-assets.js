export function assetService(path) {
  const name = path.split('/').pop()
  if (
    /^(?:clangd\.wasm|clangd-runtime\.mjs|headers\.data|system\.index|clangd\.shared-worker(?:-[\w-]+)?\.js)$/.test(
      name,
    )
  )
    return 'clangd'
  if (name === 'pyright.worker.js') return 'python'
  if (/^ts\.worker(?:-[\w-]+)?\.js$/.test(name)) return 'typescript'
}
