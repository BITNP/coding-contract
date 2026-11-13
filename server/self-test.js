import { languages } from '../shared/languages.js'
import { evaluate } from './judge.js'
import { question } from './question.js'

for (const { id, name } of languages) {
  const result = await evaluate({
    language: id,
    source: question.templates[id],
    indicators: [],
    mode: 'sample',
  })
  if (result.verdict !== 'AC') throw new Error(`${name} 自检失败：${result.message || result.verdict}`)
}

console.log(`评测环境就绪，${languages.length} 种语言自检通过。`)
