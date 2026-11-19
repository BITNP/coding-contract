import { languages } from '../shared/languages.js'
import { evaluate } from './judge.js'
import question from './questions/max-rise.js'
import solutions from './questions/max-rise-solutions.js'

for (const { id, name } of languages) {
  const result = await evaluate({
    language: id,
    source: solutions[id],
    indicators: [],
    question,
    mode: 'sample',
  })
  if (result.verdict !== 'AC') throw new Error(`${name} 自检失败：${result.message || result.verdict}`)
}

console.log(`评测环境就绪，${languages.length} 种语言自检通过。`)
