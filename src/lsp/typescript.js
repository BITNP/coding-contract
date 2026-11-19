import {
  getJavaScriptWorker,
  getTypeScriptWorker,
  javascriptDefaults,
  ModuleKind,
  ScriptTarget,
  typescriptDefaults,
} from 'monaco-editor/languages/features/typescript/register.js'
import workerUrl from 'monaco-editor/languages/features/typescript/ts.worker.js?worker&url'

export { workerUrl }

const compilerOptions = {
  target: ScriptTarget.ES2020,
  module: ModuleKind.CommonJS,
  types: ['node'],
  typeRoots: ['file:///workspace/node_modules/@types'],
  skipLibCheck: true,
  noEmitOnError: true,
}
typescriptDefaults.setCompilerOptions(compilerOptions)
typescriptDefaults.setDiagnosticsOptions({
  ...typescriptDefaults.getDiagnosticsOptions(),
  noSuggestionDiagnostics: true,
})
javascriptDefaults.setCompilerOptions({ ...compilerOptions, ...javascriptDefaults.getCompilerOptions() })

let unlock
const unlocked = new Promise((resolve) => (unlock = resolve))
const failedWorkers = new Set()

export const createWorker = () => unlocked.then(() => new Worker(workerUrl, { type: 'module', name: 'typescript' }))

async function initialize(model, language) {
  const getWorker = await (language === 'typescript' ? getTypeScriptWorker() : getJavaScriptWorker())
  const worker = await getWorker(model.uri)
  await worker.getSyntacticDiagnostics(model.uri.toString())
}

export default {
  cache: 'typescript',
  assets: () => [{ url: new URL(workerUrl, location.href).href }],
  async start(model, language, signal) {
    unlock()
    if (failedWorkers.delete(language)) {
      const defaults = language === 'typescript' ? typescriptDefaults : javascriptDefaults
      defaults.setCompilerOptions(defaults.getCompilerOptions())
    }
    let timer
    try {
      await Promise.race([
        initialize(model, language),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('语言服务启动超时')), 15000)
        }),
      ])
    } catch (error) {
      if (!signal.aborted) failedWorkers.add(language)
      throw error
    } finally {
      clearTimeout(timer)
    }
  },
}
