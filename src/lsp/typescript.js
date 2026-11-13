import 'monaco-editor/languages/features/typescript/register.js'
import workerUrl from 'monaco-editor/languages/features/typescript/ts.worker.js?worker&url'

let unlock
const unlocked = new Promise((resolve) => (unlock = resolve))

export const createWorker = () => unlocked.then(() => new Worker(workerUrl, { type: 'module', name: 'typescript' }))

export default {
  name: 'typescript',
  assets: () => [{ url: new URL(workerUrl, location.href).href }],
  async start() {
    unlock()
    return () => {}
  },
}
