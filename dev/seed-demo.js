import { openDatabase, transaction } from '../server/database.js'
import { conclude, createOperation, currentRound, expire } from '../server/operations.js'
import { questions } from '../server/questions/index.js'
import { adjustContracts, contractById, pointsOf, pruneUnavailable } from '../shared/contracts.js'
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

// 每个字符代表一个回合：p 通过，a 放弃，x 超时，- 仍在作答。
const finished = [
  ['星野', 'cpp', [full, full, full], 'ppp'],
  ['Aurora', 'cpp', [full, full, full], 'ppa'],
  ['白鹭', 'python', [heavy, full, full], 'ppp'],
  ['风间', 'java', [heavy, heavy, heavy], 'ppp'],
  ['雾岛', 'rust', [medium, heavy, heavy], 'ppp'],
  ['neko', 'cpp', [medium, medium, heavy], 'ppx'],
  ['远山', 'go', [medium, medium, medium], 'pap'],
  ['青柠', 'javascript', [light, medium, medium], 'ppp'],
  ['阿尔法', 'kotlin', [medium, light, light], 'pax'],
  ['北辰', 'c', [light, light, medium], 'ppa'],
  ['Orbit', 'typescript', [light, light, light], 'ppp'],
  ['小满', 'swift', [light, medium, medium], 'aap'],
  ['無名氏', 'lua', [light, light], 'px'],
  ['雨宫', 'csharp', [heavy, heavy, medium], 'app'],
]
const running = [
  ['林晚', 'cpp', [full, full], 'p-', [['fullscreen-exit'], ['hidden'], ['visible', 42000], ['paste', 380]]],
  ['周以安', 'python', [medium], '-', [['blur'], ['focus', 3000]]],
  ['Kestrel', 'java', [heavy, heavy], 'a-', []],
  ['陈默言之', 'rust', [light, light, light], 'pp-', [['devtools']]],
  ['Mira', 'cpp', [full], '-', [['hidden'], ['visible', 9000]]],
]

const minute = 60_000
const now = Date.now()
const iso = (ms) => new Date(ms).toISOString()

function submission(round, at, passed) {
  const { language, contracts } = round
  const question = questions[round.question]
  const source = templates[language]
  const maxScore = pointsOf(contracts)
  const verdict = passed ? 'AC' : 'WA'
  const usage = { timeMs: 2, memoryBytes: 262144 }
  const cases = Array.from({ length: passed ? question.cases.length : 1 }, (_, index) => ({
    number: index + 1,
    verdict,
    ...usage,
  }))
  return {
    language,
    source,
    contracts,
    submittedAt: iso(at),
    result: {
      mode: 'submit',
      verdict,
      passed,
      score: passed ? maxScore : 0,
      maxScore,
      checks: contracts.map((id) => {
        const { name, points, verification } = contractById[id]
        return {
          id,
          name,
          points,
          status: verification === 'manual' ? 'manual' : 'passed',
          messages: [],
          ranges: [],
        }
      }),
      cases,
      totalCases: question.cases.length,
      ...usage,
      sourceBytes: Buffer.byteLength(source),
      codeLines: source.split('\n').filter((line) => line.trim()).length,
      message: passed ? '' : '第 1 组数据：WA',
    },
  }
}

function play(id, [name, language, selections, outcomes, events], start, seed) {
  const indicators = pruneUnavailable(selections[0], language)
  const operation = createOperation({
    id,
    language,
    indicators,
    user: { id, name, avatar: null },
    now: start,
  })
  const timeBudget = Math.min(now, Date.parse(operation.deadline)) - start
  let at = start
  for (const [step, outcome] of [...outcomes].entries()) {
    const round = currentRound(operation)
    if (step > 0) {
      round.contracts = adjustContracts(round.contracts, pruneUnavailable(selections[step], language))
      operation.version++
    }
    if (round.phase === 'choosing' && outcome !== 'a' && outcome !== 'x') {
      Object.assign(round, { question: round.choices[seed % round.choices.length], phase: 'active' })
      operation.version++
    }
    if (outcome === '-') break
    if (outcome === 'x') {
      expire(operation)
    } else {
      at += Math.round((timeBudget / 4) * (0.55 + ((seed * 7 + step * 11) % 9) / 18))
      if (outcome === 'p') round.submission = submission(round, at, true)
      conclude(
        operation,
        { phase: outcome === 'p' ? 'passed' : 'abandoned', score: round.submission?.result.score ?? 0 },
        iso(at),
      )
    }
    operation.version++
  }

  if (events) {
    at = now - (seed === 2 ? 7 * minute : 3000)
    operation.events = events.map(([type, detail], index) => {
      const at = now - (8 - index) * minute
      return { type, at, receivedAt: at + 400, detail }
    })
    if (seed % 2) {
      const round = currentRound(operation)
      round.submission = submission(round, at - minute, false)
      operation.version++
    }
  }
  operation.seenAt = iso(at)
  operation.live = { source: templates[language], language, at: operation.seenAt }
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
