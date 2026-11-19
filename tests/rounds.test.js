import assert from 'node:assert/strict'
import { test } from 'node:test'
import { adjustContracts } from '../shared/contracts.js'
import { defineQuestion } from '../server/questions/data.js'
import { publicQuestion, questions, roundPlan } from '../server/questions/index.js'
import { closed, conclude, createOperation, currentRound, expire, operationView } from '../server/operations.js'

const block = (content, heading) => content.match(new RegExp(`## ${heading}\\s+~~~text\\n([\\s\\S]*?)~~~`))[1].trim()
const sampleOf = (content) => ({ input: block(content, '输入样例'), answer: block(content, '输出样例') })
const rejects = (cases, parse, solve) =>
  cases.some((item) => String(solve(parse(item.input))) !== item.answer)

test('公开题面不生成判题数据，同题的评测复用首次生成的用例', () => {
  let builds = 0
  const question = defineQuestion({ id: 'test' }, () => {
    builds++
    return []
  })
  publicQuestion(question)
  assert.equal(builds, 0)
  assert.strictEqual(question.cases, question.cases)
  assert.equal(builds, 1)
})

test('回合题目齐全、标题四字，题面样例即第一组数据', () => {
  for (const id of roundPlan.flat()) assert.ok(questions[id], id)
  assert.deepEqual(
    roundPlan.map((choices) => choices.length),
    [1, 3, 1],
  )
  for (const question of Object.values(questions)) {
    assert.equal([...question.title].length, 4, question.id)
    assert.ok(question.cases.length >= 10, question.id)
    assert.deepEqual(sampleOf(question.content), {
      input: question.cases[0].input.trim(),
      answer: question.cases[0].answer.trim(),
    })
    for (const item of question.cases) assert.ok(item.input.trim() && /^-?\d+$/.test(item.answer), question.id)
    assert.deepEqual(Object.keys(publicQuestion(question)), [
      'id',
      'title',
      'category',
      'content',
      'timeLimitMs',
      'memoryLimitBytes',
    ])
  }
  for (const id of ['max-rise', 'max-subarray'])
    assert.ok(questions[id].cases.some(({ input }) => input.trimEnd().split('\n').length > 2), id)
})

const numbers = (input) => input.trim().split(/\s+/).map(Number)

test('最长升温：小数据由穷举核对，拒绝非严格上升和计数类错解', () => {
  const { cases } = questions['max-rise']
  const parse = (input) => numbers(input).slice(1)
  const brute = (t) => {
    let best = 0
    for (let i = 0; i < t.length; i++) {
      let j = i + 1
      while (j < t.length && t[j] > t[j - 1]) j++
      best = Math.max(best, j - i)
    }
    return best
  }
  for (const item of cases) {
    const values = parse(item.input)
    assert.ok(values.length >= 1 && values.length <= 200000)
    assert.ok(values.every((v) => Math.abs(v) <= 1e9))
    if (values.length <= 100) assert.equal(item.answer, String(brute(values)))
  }
  assert.ok(cases.some((item) => item.answer === '200000'))
  const run = (t, rises) => t.reduce(([best, length], v, i) => {
    const next = i && rises(t[i - 1], v) ? length + 1 : 1
    return [Math.max(best, next), next]
  }, [0, 0])[0]
  assert.ok(rejects(cases, parse, (t) => run(t, (a, b) => b >= a)))
  assert.ok(rejects(cases, parse, (t) => 1 + t.filter((v, i) => i && v > t[i - 1]).length))
  assert.ok(rejects(cases, parse, (t) => run(t, (a, b) => b > a) - 1))
})

const parseMaze = (input) => input.trim().split('\n').slice(1)
function search(rows, moves, walls = true) {
  const height = rows.length
  const width = rows[0].length
  const find = (mark) => {
    const y = rows.findIndex((row) => row.includes(mark))
    return [y, rows[y].indexOf(mark)]
  }
  const [sy, sx] = find('S')
  const [ey, ex] = find('E')
  const distance = rows.map((row) => [...row].map(() => -1))
  distance[sy][sx] = 0
  const queue = [[sy, sx]]
  for (const [y, x] of queue) {
    for (const [dy, dx] of moves) {
      const ny = y + dy
      const nx = x + dx
      if (ny < 0 || nx < 0 || ny >= height || nx >= width || distance[ny][nx] >= 0) continue
      if (walls && rows[ny][nx] === '#') continue
      distance[ny][nx] = distance[y][x] + 1
      queue.push([ny, nx])
    }
  }
  return distance[ey][ex]
}
const four = [[1, 0], [-1, 0], [0, 1], [0, -1]]

test('迷宫寻路：小图由松弛迭代核对，大图答案固定，拒绝八向、无视障碍和不判无解', () => {
  const { cases } = questions.maze
  const relax = (rows) => {
    const cells = rows.join('')
    const width = rows[0].length
    const distance = [...cells].map((cell) => (cell === 'S' ? 0 : Infinity))
    for (let changed = true; changed; ) {
      changed = false
      for (let i = 0; i < cells.length; i++) {
        if (cells[i] === '#') continue
        const x = i % width
        const near = [i - width, i + width, x ? i - 1 : -1, x < width - 1 ? i + 1 : -1]
        const best = Math.min(...near.filter((j) => j >= 0 && j < cells.length).map((j) => distance[j] + 1))
        if (best < distance[i]) [distance[i], changed] = [best, true]
      }
    }
    const end = distance[cells.indexOf('E')]
    return end === Infinity ? -1 : end
  }
  for (const item of cases) {
    const rows = parseMaze(item.input)
    const [r, c] = numbers(item.input.split('\n')[0])
    assert.equal(rows.length, r)
    assert.ok(rows.every((row) => row.length === c && /^[.#SE]+$/.test(row)))
    assert.ok(r <= 100 && c <= 100 && r * c >= 2)
    assert.equal(rows.join('').split('S').length, 2)
    assert.equal(rows.join('').split('E').length, 2)
    if (r * c <= 400) assert.equal(item.answer, String(relax(rows)))
  }
  for (const answer of ['-1', '99', '198', '297', '4950'])
    assert.ok(
      cases.some((item) => item.answer === answer),
      answer,
    )
  const eight = [...four, [1, 1], [1, -1], [-1, 1], [-1, -1]]
  assert.ok(rejects(cases, parseMaze, (rows) => search(rows, eight)))
  assert.ok(rejects(cases, parseMaze, (rows) => search(rows, four, false)))
  assert.ok(rejects(cases, parseMaze, (rows) => Math.max(0, search(rows, four))))
})

test('信道排班：小数据穷举所有可行子集，覆盖乱序、区间相接及贪心反例', () => {
  const { cases } = questions['channel-schedule']
  const small = []
  const compatible = ([start, end], [otherStart, otherEnd]) => end <= otherStart || otherEnd <= start
  function brute(requests, index, chosen) {
    if (index === requests.length) return chosen.length
    const best = brute(requests, index + 1, chosen)
    const next = requests[index]
    if (!chosen.every((request) => compatible(request, next))) return best
    return Math.max(best, brute(requests, index + 1, [...chosen, next]))
  }

  for (const { input, answer } of cases) {
    const [size, ...lines] = input.trim().split('\n')
    const requests = lines.map(numbers)
    assert.equal(requests.length, Number(size))
    assert.ok(requests.length <= 200000)
    assert.ok(requests.every(([s, e]) => Number.isInteger(s) && Number.isInteger(e) && 0 <= s && s < e && e <= 1e9))
    if (requests.length <= 12) {
      assert.equal(Number(answer), brute(requests, 0, []))
      small.push({ requests, answer: Number(answer) })
    }
  }
  assert.ok(small.some(({ requests, answer }) => !requests.length && answer === 0))
  assert.ok(cases.some(({ answer }) => answer === '200000'))

  function select(requests, compare, accepts = compatible) {
    const chosen = []
    for (const request of requests.toSorted(compare)) {
      if (chosen.every((other) => accepts(other, request))) chosen.push(request)
    }
    return chosen.length
  }
  for (const wrong of [
    (requests) => select(requests, () => 0),
    (requests) => select(requests, ([a], [b]) => a - b),
    (requests) => select(requests, ([a, b], [c, d]) => (b - a) - (d - c)),
    (requests) => select(requests, (a, b) => a[1] - b[1], ([, end], [start]) => end < start),
  ]) {
    assert.ok(small.some(({ requests, answer }) => wrong(requests) !== answer))
  }
})

test('物资周转：小数据由区间转移穷举核对，拒绝忽略手续费、逐日贪心、双边收费和 32 位溢出', () => {
  const { cases } = questions['fee-trading']
  const parse = (input) => {
    const [n, fee, ...prices] = numbers(input)
    assert.equal(prices.length, n)
    return { fee, prices }
  }
  const brute = ({ fee, prices }) => {
    const best = [0]
    for (let j = 1; j < prices.length; j++) {
      best[j] = best[j - 1]
      for (let i = 0; i < j; i++) best[j] = Math.max(best[j], best[i] + prices[j] - prices[i] - fee)
    }
    return best.at(-1)
  }
  const dp = ({ fee, prices }, wrap = (v) => v, sellFee = fee) => {
    let cash = 0
    let hold = -Infinity
    for (const price of prices) {
      hold = Math.max(hold, wrap(cash - price - (fee - sellFee)))
      cash = Math.max(cash, wrap(hold + price - sellFee))
    }
    return cash
  }
  for (const item of cases) {
    const { fee, prices } = parse(item.input)
    assert.ok(prices.length >= 1 && prices.length <= 200000)
    assert.ok(fee >= 0 && fee <= 1e9 && prices.every((p) => p >= 1 && p <= 1e9))
    if (prices.length <= 100) assert.equal(item.answer, String(brute({ fee, prices })))
  }
  assert.ok(cases.some((item) => Number(item.answer) > 2 ** 31))
  assert.ok(rejects(cases, parse, ({ prices }) => dp({ fee: 0, prices })))
  assert.ok(
    rejects(cases, parse, ({ fee, prices }) =>
      prices.reduce((sum, p, i) => sum + (i ? Math.max(0, p - prices[i - 1] - fee) : 0), 0),
    ),
  )
  assert.ok(rejects(cases, parse, ({ fee, prices }) => dp({ fee: 2 * fee, prices }, undefined, fee)))
  assert.ok(rejects(cases, parse, (input) => dp(input, (v) => (Number.isFinite(v) ? v | 0 : v))))
})

const startedAt = Date.parse('2026-01-01T00:00:00Z')
const atMinute = (minute) => new Date(startedAt + minute * 60_000).toISOString()
const create = (indicators = ['time-1', 'source-1']) =>
  createOperation({
    id: 'op',
    language: 'cpp',
    indicators,
    user: { id: 'u', name: '测试' },
    now: startedAt,
  })

test('作战按 1+3+1 回合推进，指标沿用，未开放回合不泄露题目', () => {
  const operation = create()
  assert.equal(operation.deadline, '2026-01-01T00:50:00.000Z')
  assert.equal(closed(operation, 0, Date.parse('2026-01-01T00:50:00Z')), false)
  assert.equal(closed(operation, 0, Date.parse('2026-01-01T00:50:01Z')), true)
  assert.equal(closed(operation, 90_000, Date.parse('2026-01-01T00:51:00Z')), false)
  assert.equal(currentRound(operation).phase, 'active')
  assert.equal(currentRound(operation).question, 'max-rise')

  const view = operationView({ ...operation, events: [{}], live: {}, seenAt: 'x' }, 7)
  assert.equal(view.serverTime, 7)
  assert.equal(view.total, 0)
  assert.equal(view.version, 0)
  assert.equal(view.language, undefined)
  assert.equal(view.rounds[0].language, 'cpp')
  for (const key of ['events', 'live', 'seenAt']) assert.equal(view[key], undefined)
  assert.equal(view.rounds[0].question.id, 'max-rise')
  assert.equal(view.rounds[0].question.cases, undefined)
  assert.deepEqual(view.rounds[0].contracts, ['time-1', 'source-1'])
  assert.deepEqual(view.rounds[1], { index: 1, phase: 'pending' })
  assert.deepEqual(view.rounds[2], { index: 2, phase: 'pending' })
  assert.ok(!JSON.stringify(view).includes('迷宫寻路'))

  const first = currentRound(operation)
  first.contracts = adjustContracts(first.contracts, ['time-3', 'source-2', 'lines-1'])
  assert.deepEqual(first.contracts, ['time-1', 'source-2', 'lines-1'])
  first.language = 'c'
  conclude(operation, { phase: 'passed', score: 4 }, atMinute(5))
  assert.equal(operation.total, 4)
  assert.equal(operation.current, 1)
  const choosing = currentRound(operation)
  assert.equal(choosing.phase, 'choosing')
  assert.equal(choosing.language, 'c')
  assert.equal(choosing.question, null)
  assert.deepEqual(choosing.contracts, ['time-1', 'source-2', 'lines-1'])
  const shown = operationView(operation).rounds[1]
  assert.deepEqual(
    shown.choices.map((question) => question.id),
    ['max-subarray', 'maze', 'channel-schedule'],
  )
  assert.ok(shown.choices.every((question) => !question.cases && !question.solutions))
  assert.equal(operationView(operation).rounds[2].phase, 'pending')

  conclude(operation, { phase: 'abandoned', score: 0 }, atMinute(10))
  assert.equal(currentRound(operation).phase, 'active')
  assert.equal(currentRound(operation).question, 'fee-trading')
  assert.equal(operation.finishedAt, undefined)
  conclude(operation, { phase: 'passed', score: 3 }, atMinute(15))
  assert.equal(operation.finishedAt, atMinute(15))
  assert.equal(operation.current, 2)
  assert.equal(operation.total, 7)
  assert.equal(operationView(operation).total, 7)
})

test('第三回合放弃即结束作战并结算', () => {
  const operation = create()
  conclude(operation, { phase: 'passed', score: 2 }, atMinute(5))
  conclude(operation, { phase: 'abandoned', score: 0 }, atMinute(10))
  conclude(operation, { phase: 'abandoned', score: 0 }, atMinute(15))
  assert.equal(operation.finishedAt, atMinute(15))
  assert.deepEqual(
    operation.rounds.map((round) => round.phase),
    ['passed', 'abandoned', 'abandoned'],
  )
  assert.equal(operation.total, 2)
  assert.equal(closed(operation), true)
})

test('选题超时按截止时间结算已得分，并保留未开放回合', () => {
  const operation = create()
  conclude(operation, { phase: 'passed', score: 2 }, atMinute(5))
  expire(operation)
  assert.equal(operation.finishedAt, operation.deadline)
  assert.equal(operation.total, 2)
  assert.equal(currentRound(operation).score, 0)
  assert.deepEqual(operation.rounds.map((round) => round.phase), ['passed', 'expired', 'pending'])
})

test('截止前送交、到时才通过的提交计分并直接结算', () => {
  const operation = create()
  conclude(operation, { phase: 'passed', score: 2 }, atMinute(49), Date.parse(atMinute(51)))
  assert.equal(operation.finishedAt, operation.deadline)
  assert.equal(operation.total, 2)
  assert.equal(operation.current, 0)
  assert.deepEqual(operation.rounds.map((round) => round.phase), ['passed', 'pending', 'pending'])
})
