import { parser as cpp } from '@lezer/cpp'
import { parser as python } from '@lezer/python'
import { syntaxFacts } from './syntaxFacts.js'

const parsers = { c: cpp, cpp, python }

// 剔除注释，保留字符串与物理行；统计行数不要求语法完整。
export function sourceFacts(source, language, tokens) {
  const bytes = new TextEncoder().encode(source).length
  const parser = parsers[language]
  // 其余语言复用 Monaco 的词法结果，不套用 C++ 语法。
  if (!parser) {
    const lines = source.split('\n')
    const codeLines = tokens?.filter((line, index) =>
      line.some(
        (token, i) =>
          !/^comment(?:\.|$)/.test(token.type) &&
          lines[index].slice(token.offset, line[i + 1]?.offset).trim(),
      ),
    ).length
    return { bytes, codeLines }
  }
  const tree = parser.parse(source)
  let code = ''
  let end = 0
  tree.iterate({
    enter(node) {
      if (['Comment', 'LineComment', 'BlockComment'].includes(node.name)) {
        code += source.slice(end, node.from) + source.slice(node.from, node.to).replace(/[^\n]/g, ' ')
        end = node.to
        return false
      }
    },
  })
  code += source.slice(end)
  return {
    bytes,
    codeLines: code.split('\n').filter((line) => line.trim()).length,
    ...syntaxFacts(tree, source, language),
  }
}
