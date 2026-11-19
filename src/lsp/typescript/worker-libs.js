import typescript from 'typescript/lib/typescriptServices.js'

export { typescript }
export const { createLanguageService, ScriptKind } = typescript

const declarations = import.meta.glob(
  [
    './node_modules/typescript/lib/lib*.d.ts',
    './node_modules/{@types/node,undici-types}/**/*.d.ts',
    './node_modules/{@types/node,undici-types}/package.json',
  ],
  { eager: true, query: '?raw', import: 'default' },
)

export const libFileMap = Object.fromEntries(
  Object.entries(declarations).map(([path, content]) => [
    path.startsWith('./node_modules/typescript/')
      ? path.split('/').at(-1)
      : new URL(path, 'file:///workspace/').href,
    content,
  ]),
)
