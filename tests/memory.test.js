import assert from 'node:assert/strict'
import { test } from 'node:test'
import { evaluate } from '../server/judge.js'
import { question, cases } from '../server/question.js'
import { checksFor, contractById } from '../shared/contracts.js'

test('内存档位使用十进制字节数，订书钉保留 ID 并降为一分', () => {
  assert.deepEqual(
    ['memory-1', 'memory-2', 'memory-3'].map((id) => checksFor(id)[0].limit),
    [16_000_000, 4_000_000, 325_325],
  )
  assert.equal(contractById['brackets-2'].points, 1)
  assert.equal(contractById['brackets-2'].level, 1)
})

test('同一运行峰值按预算单调判定，指标不改变沙箱硬上限', async (t) => {
  let index = 0
  const limits = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (options.method === 'DELETE') return new Response('')
    const [cmd] = JSON.parse(options.body).cmd
    if (cmd.args[1] === 'analyze.py')
      return Response.json([{ status: 'Accepted', files: { stdout: '{"bytes":198,"codeLines":6}' } }])
    if (cmd.args[0] === '/usr/bin/clang++')
      return Response.json([{ status: 'Accepted', fileIds: { main: 'test-binary' } }])
    limits.push(cmd.memoryLimit)
    // 来自复现实验：程序正常退出且答案正确，cgroup 峰值为 520 KiB。
    return Response.json([
      {
        status: 'Accepted',
        exitStatus: 0,
        memory: 532_480,
        time: 20_000_000,
        files: { stdout: cases[index++].answer, stderr: '' },
      },
    ])
  })
  for (const [id, verdict] of [
    ['memory-3', 'MLE'],
    ['memory-2', 'AC'],
    ['memory-1', 'AC'],
  ]) {
    index = 0
    const result = await evaluate({
      language: 'cpp',
      source: question.templates.cpp,
      indicators: ['ancient-3', id],
    })
    assert.equal(result.verdict, verdict)
    assert.equal(
      result.checks.find((check) => check.id === id).status,
      verdict === 'AC' ? 'passed' : 'failed',
    )
    assert.equal(result.cases.length, verdict === 'AC' ? cases.length : 1)
  }
  assert.ok(limits.every((limit) => limit === question.memoryLimitBytes))
})
