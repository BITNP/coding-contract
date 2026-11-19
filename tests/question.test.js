import assert from 'node:assert/strict'
import { test } from 'node:test'
import { languages } from '../shared/languages.js'
import solutions from '../server/questions/max-rise-solutions.js'
import { defineQuestion } from '../server/questions/data.js'
import { publicQuestion, questions } from '../server/questions/index.js'

const block = (content, heading) =>
  content.match(new RegExp(`## ${heading}\\s+~~~text\\n([\\s\\S]*?)~~~`))[1].trim()
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

test('三个题面公开首组样例，参考解覆盖所有语言', () => {
  assert.deepEqual(Object.keys(questions), ['max-rise', 'channel-schedule', 'maze'])
  assert.deepEqual(Object.keys(solutions).sort(), languages.map(({ id }) => id).sort())
  for (const source of Object.values(solutions)) assert.ok(Buffer.byteLength(source) <= 1024)
  for (const question of Object.values(questions)) {
    assert.equal([...question.title].length, 4, question.id)
    assert.ok(question.cases.length >= 10, question.id)
    assert.deepEqual(sampleOf(question.content), {
      input: question.cases[0].input.trim(),
      answer: question.cases[0].answer.trim(),
    })
    for (const item of question.cases)
      assert.ok(item.input.trim() && /^-?\d+$/.test(item.answer), question.id)
    assert.deepEqual(Object.keys(publicQuestion(question)), [
      'id',
      'title',
      'category',
      'content',
      'timeLimitMs',
      'memoryLimitBytes',
    ])
  }
  assert.ok(questions['max-rise'].cases.some(({ input }) => input.trimEnd().split('\n').length > 2))
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
  const run = (t, rises) =>
    t.reduce(
      ([best, length], v, i) => {
        const next = i && rises(t[i - 1], v) ? length + 1 : 1
        return [Math.max(best, next), next]
      },
      [0, 0],
    )[0]
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
const four = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

test('迷宫寻路：小图由松弛迭代核对，大图答案固定，拒绝八向、无视障碍和不判无解', () => {
  const { cases } = questions.maze
  const relax = (rows) => {
    const cells = rows.join('')
    const width = rows[0].length
    const distance = [...cells].map((cell) => (cell === 'S' ? 0 : Infinity))
    for (let changed = true; changed;) {
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
    assert.ok(
      requests.every(([s, e]) => Number.isInteger(s) && Number.isInteger(e) && 0 <= s && s < e && e <= 1e9),
    )
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
    (requests) => select(requests, ([a, b], [c, d]) => b - a - (d - c)),
    (requests) =>
      select(
        requests,
        (a, b) => a[1] - b[1],
        ([, end], [start]) => end < start,
      ),
  ]) {
    assert.ok(small.some(({ requests, answer }) => wrong(requests) !== answer))
  }
})
