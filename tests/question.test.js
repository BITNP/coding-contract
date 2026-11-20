import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defineQuestion } from '../server/questions/data.js'
import { questions } from '../server/questions/index.js'

const block = (content, heading) =>
  content.match(new RegExp(`## ${heading}\\s+~~~text\\n([\\s\\S]*?)~~~`))[1].trim()

test('用例延迟到首次评测时生成，同一题只生成一次', () => {
  let builds = 0
  const question = defineQuestion({ id: 'test' }, () => {
    builds++
    return []
  })
  assert.equal(builds, 0)
  assert.strictEqual(question.cases, question.cases)
  assert.equal(builds, 1)
})

test('三道题的公开样例与评测使用的首组输入输出一致', () => {
  for (const question of Object.values(questions)) {
    const sample = question.cases[0]
    assert.equal(block(question.content, '输入样例'), sample.input.trim(), question.id)
    assert.equal(block(question.content, '输出样例'), sample.answer, question.id)
  }
})

const numbers = (input) => input.trim().split(/\s+/).map(Number)

test('最长升温：小数据由穷举核对，拒绝非严格上升和计数类错解', () => {
  const { cases } = questions['max-rise']
  const small = []
  const brute = (t, rises = (a, b) => b > a) => {
    let best = 0
    for (let i = 0; i < t.length; i++) {
      let j = i + 1
      while (j < t.length && rises(t[j - 1], t[j])) j++
      best = Math.max(best, j - i)
    }
    return best
  }
  for (const item of cases) {
    const [size, ...values] = numbers(item.input)
    assert.equal(values.length, size)
    assert.ok(values.length >= 1 && values.length <= 200000)
    assert.ok(values.every((v) => Math.abs(v) <= 1e9))
    if (values.length <= 100) {
      assert.equal(item.answer, String(brute(values)))
      small.push({ values, answer: Number(item.answer) })
    }
  }
  assert.ok(cases.some((item) => item.answer === '200000'))
  assert.ok(cases.some(({ input }) => input.trimEnd().split('\n').length > 2))
  assert.ok(small.some(({ values, answer }) => brute(values, (a, b) => b >= a) !== answer))
  assert.ok(
    small.some(({ values, answer }) => 1 + values.filter((v, i) => i && v > values[i - 1]).length !== answer),
  )
  assert.ok(small.some(({ values, answer }) => values.length === 1 && answer === 1))
})

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
    const [size, ...rows] = item.input.trimEnd().split('\n')
    const [r, c] = numbers(size)
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
  assert.ok(
    cases.some(({ input, answer }) => answer === '-1' && input.trim().split(/\s+/).join(' ') === '2 2 S# #E'),
  )
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

  function rejects(order, fits = compatible) {
    return small.some(({ requests, answer }) => {
      const chosen = []
      for (const request of requests.toSorted(order))
        if (chosen.every((other) => fits(other, request))) chosen.push(request)
      return chosen.length !== answer
    })
  }
  assert.ok(
    rejects(() => 0),
    '按输入顺序',
  )
  assert.ok(
    rejects(([a], [b]) => a - b),
    '最早开始优先',
  )
  assert.ok(
    rejects(([a, b], [c, d]) => b - a - (d - c)),
    '最短优先',
  )
  assert.ok(
    rejects(
      (a, b) => a[1] - b[1],
      ([, end], [start]) => end < start,
    ),
    '拒绝首尾相接',
  )
})
