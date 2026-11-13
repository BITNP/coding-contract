import { languages } from './languages.js'

const MiB = 1024 * 1024
const syntaxChecks = new Set(['names', 'syntax', 'operators'])

// 同组只能选择一档。inherits 继承检查项，不要求同时选中，也不重复计分。
// 检查源码中定义的名字；C/C++ 入口 main 豁免，标准库声明不参与检查。
export const groups = [
  {
    id: 'ancient',
    name: '古法编程',
    icon: 302,
    column: 3,
    verification: 'manual',
    variants: [
      { level: 1, description: '禁用大模型思考模式' },
      { level: 2, description: '禁用大模型思考模式，参数量上限 10B', inherits: ['ancient-1'] },
      { level: 3, description: '禁用大模型及代码补全工具', key: true },
    ],
  },
  {
    id: 'shrink',
    name: '改写：谜语人',
    icon: 101,
    column: 4,
    requires: ['ancient-3'],
    variants: [
      {
        level: 1,
        description: '变量、函数及参数名仅可由同一字母构成',
        checks: [{ type: 'names', kinds: ['variable', 'function', 'parameter'], sameLetter: true }],
      },
      {
        level: 2,
        description: '变量名仅可使用 i、j、k',
        checks: [{ type: 'names', kinds: ['variable'], pattern: '^[ijk]$' }],
      },
      {
        level: 3,
        description: '变量、函数及参数名仅可使用 i、j、k',
        inherits: ['shrink-2'],
        checks: [{ type: 'names', kinds: ['function', 'parameter'], pattern: '^[ijk]$' }],
      },
    ],
  },
  {
    id: 'source',
    name: '环境：存储枯竭',
    icon: 111,
    column: 0,
    variants: [
      { level: 1, description: '源代码长度上限 1024 字节', checks: [{ type: 'maxBytes', limit: 1024 }] },
      { level: 2, description: '源代码长度上限 512 字节', checks: [{ type: 'maxBytes', limit: 512 }] },
      { level: 3, description: '源代码长度上限 256 字节', checks: [{ type: 'maxBytes', limit: 256 }] },
    ],
  },
  {
    id: 'memory',
    name: '环境：内存枯竭',
    icon: 114,
    column: 5,
    requires: ['ancient-3'],
    variants: [
      { level: 1, description: '运行内存上限 256 MiB', checks: [{ type: 'maxMemory', limit: 256 * MiB }] },
      { level: 2, description: '运行内存上限 64 MiB', checks: [{ type: 'maxMemory', limit: 64 * MiB }] },
      {
        level: 3,
        description: '运行内存上限 4 MiB',
        languages: languages.filter((language) => language.tinyMemory).map((language) => language.id),
        checks: [{ type: 'maxMemory', limit: 4 * MiB }],
      },
    ],
  },
  {
    id: 'lines',
    name: '十行代码',
    icon: 122,
    column: 1,
    variants: [
      {
        level: 1,
        description: '源代码须恰含 10 个非空、非注释行',
        checks: [{ type: 'codeLines', equals: 10 }],
      },
    ],
  },
  {
    id: 'linear',
    name: '控制：线性思维',
    icon: 117,
    column: 6,
    requires: ['ancient-3'],
    variants: [
      {
        level: 1,
        description: '禁用所有循环语句',
        checks: [{ type: 'syntax', forbidden: ['for', 'while', 'do'] }],
      },
      {
        level: 3,
        description: '禁用循环及条件语句，仅保留 switch / match',
        inherits: ['linear-1'],
        checks: [{ type: 'syntax', forbidden: ['if', 'conditional'] }],
      },
    ],
  },
  {
    id: 'vowels',
    name: '改写：失语症',
    icon: 103,
    column: 7,
    requires: ['ancient-3'],
    variants: [
      {
        level: 1,
        description: '变量名中禁用 a、e、i、o、u',
        checks: [{ type: 'names', kinds: ['variable'], pattern: '^[^aeiouAEIOU]*$' }],
      },
    ],
  },
  {
    id: 'brackets',
    name: '控制：订书钉',
    icon: 107,
    column: 2,
    variants: [
      { level: 2, description: '禁用字符 [ 和 ]', checks: [{ type: 'characters', forbidden: ['[', ']'] }] },
    ],
  },
  {
    id: 'arithmetic',
    name: '控制：低等数学',
    icon: 207,
    column: 8,
    requires: ['ancient-3'],
    variants: [
      {
        level: 1,
        description: '禁用四则、取余及对应复合赋值运算',
        checks: [
          {
            type: 'operators',
            forbidden: ['+', '-', '*', '/', '%', '+=', '-=', '*=', '/=', '%='],
            arity: 'binary',
          },
        ],
      },
      {
        level: 2,
        description: '禁用四则、取余及自增自减运算',
        languages: languages.filter((language) => language.increment).map((language) => language.id),
        inherits: ['arithmetic-1'],
        checks: [{ type: 'operators', forbidden: ['++', '--'], arity: 'unary' }],
      },
      {
        level: 3,
        description: '禁用四则、取余、自增自减及位运算',
        languages: languages.filter((language) => language.increment).map((language) => language.id),
        inherits: ['arithmetic-2'],
        checks: [
          {
            type: 'operators',
            forbidden: ['&', '|', '^', '<<', '>>', '&=', '|=', '^=', '<<=', '>>='],
            arity: 'binary',
          },
          { type: 'operators', forbidden: ['~'], arity: 'unary' },
        ],
      },
    ],
  },
  {
    id: 'keyboard',
    name: '环境：静音',
    icon: 124,
    column: 9,
    requires: ['ancient-3'],
    verification: 'manual',
    variants: [{ level: 3, description: '禁用实体键盘' }],
  },
]

export const indicators = groups.flatMap((group) =>
  group.variants.map((variant) => ({
    ...variant,
    id: `${group.id}-${variant.level}`,
    group: group.id,
    name: `${group.name} ${['I', 'II', 'III'][variant.level - 1]}`,
    column: group.column,
    icon: `/assets/icon_activity_contract_tag_${group.icon}.png`,
    points: variant.level,
    languages:
      variant.languages ||
      languages
        .filter(
          (language) => language.analysis || !variant.checks?.some((rule) => syntaxChecks.has(rule.type)),
        )
        .map((language) => language.id),
    verification: group.verification || 'automatic',
    requires: group.requires || [],
    locked: Boolean(group.requires?.length),
    inherits: variant.inherits || [],
    checks: variant.checks || [],
  })),
)

export const defaultSelection = []
export const columnCount = groups.length
export const contractById = Object.fromEntries(indicators.map((item) => [item.id, item]))

export function checksFor(id) {
  const item = contractById[id]
  return [...item.inherits.flatMap(checksFor), ...item.checks]
}

export function unavailableReason(id, ids, language = 'cpp') {
  const item = contractById[id]
  const missing = item.requires.find((required) => !ids.includes(required))
  if (missing) return `需先选入锁闭指标「${contractById[missing].name}」`
  if (!item.languages.includes(language)) return '当前语言不可用'
  return ''
}

// 前端提示和服务端拒绝请求共用这一处判断，服务端始终接收 ID，自行取规则和分值。
export function selectionErrors(ids, language = 'cpp') {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) return ['词条必须是 ID 数组']
  if (!languages.some((item) => item.id === language)) return ['不支持的编程语言']
  const errors = []
  const selectedGroups = new Set()
  for (const id of ids) {
    const item = Object.hasOwn(contractById, id) ? contractById[id] : null
    if (!item) {
      errors.push(`未知词条：${id}`)
      continue
    }
    if (selectedGroups.has(item.group)) errors.push(`同组词条只能选择一档：${item.name}`)
    selectedGroups.add(item.group)
    const reason = unavailableReason(id, ids, language)
    if (reason) errors.push(`${item.name}：${reason}`)
  }
  return errors
}
