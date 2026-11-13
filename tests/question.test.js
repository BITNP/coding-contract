import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cases, question } from '../server/question.js'
import { languages } from '../shared/languages.js'

const valuesOf = ({ input }) => input.trim().split(/\s+/).map(Number).slice(1)
function brute(values) {
  let best = -Infinity
  for (let start = 0; start < values.length; start++) {
    let sum = 0
    for (let end = start; end < values.length; end++) {
      sum += values[end]
      best = Math.max(best, sum)
    }
  }
  return best
}

test('新题模板覆盖所有语言，均可参与 1024 字节合约', () => {
  assert.equal(question.id, 'max-subarray')
  assert.deepEqual(Object.keys(question.templates).sort(), languages.map(({ id }) => id).sort())
  for (const [id, source] of Object.entries(question.templates)) {
    assert.ok(Buffer.byteLength(source) <= 1024, id)
  }
})

test('固定种子数据符合题面范围，小数据由区间穷举独立核对', () => {
  assert.equal(cases[0].answer, '6')
  assert.ok(cases.length >= 25)
  for (const item of cases) {
    const tokens = item.input.trim().split(/\s+/).map(Number)
    const values = tokens.slice(1)
    assert.equal(tokens[0], values.length)
    assert.ok(values.length >= 1 && values.length <= 200000)
    assert.ok(values.every((v) => Number.isInteger(v) && Math.abs(v) <= 1000000))
    if (values.length < 100) assert.equal(Number(item.answer), brute(values))
  }
  assert.ok(cases.some((item) => item.answer === '200000000000'))
  assert.ok(cases.some((item) => valuesOf(item).length === 200000))
})

test('对抗数据拒绝空段、求和、正数求和、单点、前后缀及 32 位累加错解', () => {
  const wrong = [
    (a) => Math.max(0, brute(a)),
    (a) => a.reduce((s, x) => s + x, 0),
    (a) => a.reduce((s, x) => s + Math.max(0, x), 0),
    (a) => Math.max(...a),
    (a) => {
      let s = 0
      return Math.max(...a.map((x) => (s += x)))
    },
    (a) => {
      let s = 0
      return Math.max(...a.toReversed().map((x) => (s += x)))
    },
  ]
  const small = cases.filter((item) => valuesOf(item).length < 100)
  for (const solve of wrong) {
    assert.ok(small.some((item) => String(solve(valuesOf(item))) !== item.answer))
  }
  const overflow = cases.find((item) => item.answer === '200000000000')
  let sum = 0
  let best = -1000000
  for (const x of valuesOf(overflow)) {
    sum = (x + Math.max(sum, 0)) | 0
    best = Math.max(best, sum)
  }
  assert.notEqual(String(best), overflow.answer)
})
