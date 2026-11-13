import { checksFor, contractById } from './contracts.js'

const syntaxLabels = {
  for: '不允许使用 for 循环',
  while: '不允许使用 while 循环',
  do: '不允许使用 do 循环',
  if: '不允许使用 if 条件语句',
  conditional: '不允许使用条件表达式',
}
const mib = (bytes) => `${(bytes / 1048576).toFixed(2)} MiB`
const at = (item, message) => ({
  message: `第 ${item.line} 行：${message}`,
  ranges: item.from === undefined ? [] : [{ from: item.from, to: item.to, message }],
})

function occurrences(source, text, message) {
  const ranges = []
  for (let from = source.indexOf(text); from >= 0; from = source.indexOf(text, from + text.length))
    ranges.push({ from, to: from + text.length, message })
  return ranges
}

const checkers = {
  maxBytes: (rule, facts) =>
    facts.bytes > rule.limit ? [`源代码 ${facts.bytes} 字节，超出上限 ${rule.limit} 字节`] : [],
  codeLines: (rule, facts) =>
    facts.codeLines !== rule.equals ? [`当前 ${facts.codeLines} 行有效代码，需要恰好 ${rule.equals} 行`] : [],
  characters: (rule, facts, source) =>
    rule.forbidden
      .filter((char) => source.includes(char))
      .map((char) => {
        const message = `不允许使用字符 ${char}`
        return { message, ranges: occurrences(source, char, message) }
      }),
  syntax: (rule, facts) =>
    facts.syntax
      .filter((item) => rule.forbidden.includes(item.kind))
      .map((item) => at(item, syntaxLabels[item.kind])),
  operators: (rule, facts) =>
    facts.operators
      .filter((item) => (!rule.arity || rule.arity === item.arity) && rule.forbidden.includes(item.operator))
      .map((item) => at(item, `不允许使用运算符 ${item.operator}`)),
  names(rule, facts) {
    const names = facts.names.filter((item) => rule.kinds.includes(item.kind))
    return names
      .filter((item) =>
        rule.sameLetter
          ? !/^[a-zA-Z]+$/.test(item.name) || [...item.name].some((letter) => letter !== names[0].name[0])
          : !new RegExp(rule.pattern).test(item.name),
      )
      .map((item) => at(item, `不允许使用名称 ${item.name}`))
  },
  maxMemory: (rule, facts) =>
    facts.memoryExceeded || facts.memoryBytes > rule.limit
      ? [`运行内存峰值为 ${mib(facts.memoryBytes)}，超出上限 ${mib(rule.limit)}`]
      : [],
}

const requiredFacts = {
  maxBytes: 'bytes',
  codeLines: 'codeLines',
  syntax: 'syntax',
  operators: 'operators',
  names: 'names',
  maxMemory: 'memoryBytes',
}

export function checkContracts(ids, facts, source) {
  return ids.map((id) => {
    const item = contractById[id]
    if (item.verification === 'manual')
      return { id, name: item.name, points: item.points, status: 'manual', messages: [] }
    const rules = checksFor(id)
    const available = rules.filter(
      (rule) => !requiredFacts[rule.type] || facts[requiredFacts[rule.type]] !== undefined,
    )
    const pending = available.length < rules.length
    const findings = available
      .flatMap((rule) => checkers[rule.type](rule, facts, source))
      .map((finding) => (typeof finding === 'string' ? { message: finding, ranges: [] } : finding))
    const messages = findings.map((finding) => finding.message)
    const ranges = findings.flatMap((finding) => finding.ranges)
    return {
      id,
      name: item.name,
      points: item.points,
      status: messages.length ? 'failed' : pending ? 'pending' : 'passed',
      messages,
      ranges,
    }
  })
}

export function memoryLimit(ids, defaultLimit) {
  return Math.min(
    defaultLimit,
    ...ids
      .flatMap(checksFor)
      .filter((rule) => rule.type === 'maxMemory')
      .map((rule) => rule.limit),
  )
}
