import { openDatabase, transaction } from '../server/database.js'
import { createOperation, finishOperation } from '../server/operations.js'
import { questions } from '../server/questions/index.js'
import { contractById, pruneUnavailable } from '../shared/contracts.js'
import { templates } from '../shared/languages.js'

const full = [
  'time-3',
  'ancient-3',
  'shrink-3',
  'source-3',
  'memory-3',
  'lines-1',
  'linear-3',
  'vowels-1',
  'brackets-1',
  'arithmetic-3',
  'senses-3',
]
const heavy = [
  'time-2',
  'ancient-3',
  'shrink-2',
  'source-2',
  'memory-1',
  'lines-1',
  'brackets-1',
  'arithmetic-1',
  'senses-2',
]
const medium = ['time-1', 'ancient-2', 'source-2', 'lines-1', 'brackets-1', 'senses-1']
const light = ['ancient-1', 'source-1']

const finished = [
  ['星野', 'cpp', full],
  ['Aurora', 'cpp', full],
  ['白鹭', 'python', heavy],
  ['风间', 'java', heavy],
  ['雾岛', 'rust', medium],
  ['neko', 'cpp', heavy],
  ['远山', 'go', medium],
  ['青柠', 'javascript', medium],
  ['阿尔法', 'kotlin', light],
  ['北辰', 'c', medium],
  ['Orbit', 'typescript', light],
  ['小满', 'swift', medium],
  ['無名氏', 'lua', light, 'expired'],
  ['雨宫', 'csharp', heavy, 'abandoned'],
]
const running = [
  ['林晚', 'cpp', full, 'active', [['fullscreen-exit'], ['hidden'], ['visible', 42000], ['paste', 380]]],
  ['周以安', 'python', medium, 'active', [['blur'], ['focus', 3000]]],
  ['Kestrel', 'java', heavy, 'active'],
  ['陈默言之', 'rust', light, 'active', [['devtools']]],
  ['Mira', 'cpp', full, 'active', [['hidden'], ['visible', 9000]]],
]

const minute = 60_000
const now = Date.now()
const iso = (ms) => new Date(ms).toISOString()

function submission({ language, contracts }, question, at, passed) {
  const source = templates[language]
  const verdict = passed ? 'AC' : 'WA'
  const usage = { timeMs: 2, memoryBytes: 262144 }
  const cases = Array.from({ length: passed ? question.cases.length : 1 }, (_, index) => ({
    number: index + 1,
    verdict,
    ...usage,
  }))
  return {
    question: question.id,
    language,
    source,
    contracts,
    submittedAt: iso(at),
    result: {
      mode: 'submit',
      verdict,
      passed,
      checks: contracts.map((id) => ({
        id,
        status: contractById[id].verification === 'manual' ? 'manual' : 'passed',
        messages: [],
        ranges: [],
      })),
      cases,
      totalCases: question.cases.length,
      ...usage,
      sourceBytes: Buffer.byteLength(source),
      codeLines: source.split('\n').filter((line) => line.trim()).length,
      message: passed ? '' : '第 1 组数据：WA',
    },
  }
}

function play(id, [name, language, selection, phase = 'passed', events = []], start, seed) {
  const operation = createOperation({
    id,
    language,
    indicators: pruneUnavailable(selection, language),
    user: { id, name, avatar: null },
    now: start,
  })
  const choices = Object.values(questions)
  const question = choices[seed % choices.length]
  const deadline = Date.parse(operation.deadline)
  const at =
    phase === 'active'
      ? now - (seed === 2 ? 7 * minute : 3000)
      : start + (deadline - start) * (0.4 + seed / 50)
  if (phase === 'passed' || (phase === 'active' && seed % 2)) {
    operation.submission = submission(operation, question, at, phase === 'passed')
    operation.version++
  }
  if (phase !== 'active')
    finishOperation(operation, phase, phase === 'expired' ? operation.deadline : iso(at))
  operation.seenAt = iso(at)
  operation.live = { question: question.id, source: templates[language], language, at: operation.seenAt }
  operation.events = events.map(([type, detail], index) => {
    const at = now - (8 - index) * minute
    return { type, at, receivedAt: at + 400, detail }
  })
  return operation
}

const db = openDatabase()
const save = db.prepare(`
  INSERT INTO operations (id, user_id, data) VALUES (?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET data = excluded.data
`)
transaction(db, () => {
  function store(id, player, start, seed) {
    save.run(id, id, JSON.stringify(play(id, player, start, seed)))
  }
  finished.forEach((player, index) =>
    store(`demo-${index + 1}`, player, now - (3 + index * 1.5) * 60 * minute, index + 1),
  )
  running.forEach((player, index) =>
    store(`demo-live-${index + 1}`, player, now - (19 + index * 2) * minute, index),
  )
})
db.close()

console.log(`示例数据已写入：${finished.length} 场已结束作战，${running.length} 场进行中的作战`)
