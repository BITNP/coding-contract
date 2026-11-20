import assert from 'node:assert/strict'
import { test } from 'node:test'
import { evaluate } from '../server/judge.js'
import question from '../server/questions/max-rise.js'
import solutions from '../server/questions/max-rise-solutions.js'
import { checkContracts } from '../shared/checks.js'

test('跨过预算一个内存页时显示精确字节，沙箱自身的超限单独说明', () => {
  const message = (facts) => checkContracts(['memory-3'], facts, '')[0].messages[0]
  assert.equal(message({ memoryBytes: 327680 }), '运行内存峰值为 327,680 字节，超出上限 325,325 字节')
  assert.equal(
    message({ memoryBytes: 303104, memoryExceeded: true }),
    '沙箱返回内存超限，记录峰值为 303,104 字节',
  )
})

test('各档内存达到预算时通过，多一字节即超限，沙箱硬上限相同', async (t) => {
  let peak
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (options.method === 'DELETE') return new Response('')
    const [cmd] = JSON.parse(options.body).cmd
    if (cmd.args[1] === 'analyze.py')
      return Response.json([{ status: 'Accepted', files: { stdout: '{"bytes":198,"codeLines":6}' } }])
    if (cmd.copyOutCached) return Response.json([{ status: 'Accepted', fileIds: { main: 'test-binary' } }])
    assert.equal(cmd.memoryLimit, question.memoryLimitBytes)
    return Response.json([
      {
        status: 'Accepted',
        memory: peak,
        time: 0,
        files: { stdout: question.cases[0].answer },
      },
    ])
  })
  for (const [id, budget] of [
    ['memory-1', 16_000_000],
    ['memory-2', 4_000_000],
    ['memory-3', 325_325],
  ]) {
    const submission = {
      language: 'cpp',
      source: solutions.cpp,
      indicators: ['ancient-3', id],
      question,
      mode: 'sample',
    }
    peak = budget
    const within = await evaluate(submission)
    assert.equal(within.passed, true, id)
    peak++
    const over = await evaluate(submission)
    assert.equal(over.verdict, 'MLE', id)
    assert.equal(over.checks.find((check) => check.id === id).status, 'failed', id)
  }
})
