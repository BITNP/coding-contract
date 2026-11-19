import assert from 'node:assert/strict'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { json } from 'node:stream/consumers'
import { test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import maxRise from '../server/questions/max-rise.js'
import maze from '../server/questions/maze.js'
import { submitGraceMs } from '../shared/contracts.js'
import { listen, startApi } from '../server/tests/http.js'

const answers = new Map([...maxRise.cases, ...maze.cases].map(({ input, answer }) => [input, answer]))
const start = { language: 'python', indicators: ['source-1'] }
const source = 'print(1)'

async function fixture(t) {
  let beforeAnalysis
  const judge = await listen(t, async (req, res) => {
    const {
      cmd: [cmd],
    } = await json(req)
    let stdout
    if (cmd.args.includes('analyze.py')) {
      const pause = beforeAnalysis
      beforeAnalysis = undefined
      await pause?.()
      stdout = JSON.stringify({ bytes: Buffer.byteLength(cmd.copyIn['main.py'].content), codeLines: 1 })
    } else {
      stdout = answers.get(cmd.files[0].content)
    }
    res.end(JSON.stringify([{ status: 'Accepted', files: { stdout, stderr: '' }, time: 0, memory: 0 }]))
  })
  const { base, dir } = await startApi(t, { ALLOW_GUEST: '1', JUDGE_URL: judge })
  async function request(path, body, status = 200) {
    const response = await fetch(`${base}/api${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const result = await response.json()
    assert.equal(response.status, status, `${path}: ${JSON.stringify(result)}`)
    return result
  }
  function moveDeadline(id, msAgo) {
    const db = new DatabaseSync(join(dir, 'operations.sqlite'))
    const deadline = new Date(Date.now() - msAgo).toISOString()
    const createdAt = new Date(Date.parse(deadline) - 3_600_000).toISOString()
    try {
      const updated = db
        .prepare(
          "UPDATE operations SET data = json_set(data, '$.deadline', ?, '$.createdAt', ?) WHERE id = ?",
        )
        .run(deadline, createdAt, id)
      assert.equal(updated.changes, 1)
    } finally {
      db.close()
    }
    return deadline
  }
  async function duringSubmit(path, version, action, status = 200) {
    const entered = Promise.withResolvers()
    const release = Promise.withResolvers()
    beforeAnalysis = () => {
      entered.resolve()
      return release.promise
    }
    const submission = request(`${path}/submit`, { version, source }, status)
    try {
      await Promise.race([entered.promise, submission.then(() => assert.fail('评测请求未到达沙箱'))])
      await action()
    } finally {
      beforeAnalysis = undefined
      release.resolve()
    }
    return submission
  }
  return { base, request, moveDeadline, duringSubmit }
}

test('作战复用活动局，输入校验保护配置，重复放弃只推进一次', async (t) => {
  const { base, request } = await fixture(t)
  assert.equal((await fetch(base)).status, 404)
  assert.equal((await fetch(`${base}/app.js`)).status, 404)
  assert.equal((await fetch(`${base}/api/operations`, { method: 'POST' })).status, 400)
  await request('/operations', {}, 400)
  await request('/operations', { indicators: [] }, 400)
  const [first, again] = await Promise.all([request('/operations', start), request('/operations', start)])
  assert.equal(again.id, first.id)
  const path = `/operations/${first.id}`
  const { version } = first
  assert.deepEqual(first.rounds[1], { index: 1, phase: 'pending' })
  assert.deepEqual(await request('/operations/current'), { id: first.id })
  await request(`${path}/contracts`, { version, language: 'python' }, 400)
  await request(`${path}/contracts`, { version, indicators: [] }, 400)
  await request(`${path}/submit`, { version }, 400)
  await request(`${path}/abandon`, {}, 400)
  assert.deepEqual((await request(path)).rounds[0].contracts, ['source-1'])
  const next = await request(`${path}/abandon`, { version })
  await request(`${path}/abandon`, { version }, 409)
  const saved = await request(path)
  assert.equal(saved.current, 1)
  assert.equal(saved.version, next.version)
  assert.equal(saved.rounds[1].phase, 'choosing')
})

test('判题期间修改指标会拒绝过期结果，最终放弃保存完整的回合成绩', async (t) => {
  const { request, duringSubmit } = await fixture(t)
  const first = await request('/operations', start)
  const path = `/operations/${first.id}`
  const change = { version: first.version, language: 'python', indicators: ['source-2'] }
  await duringSubmit(
    path,
    first.version,
    async () => {
      await request(`${path}/submit`, { version: first.version, source }, 409)
      await request(`${path}/contracts`, change)
    },
    409,
  )
  const adjusted = await request(path)
  assert.equal(adjusted.current, 0)
  const submission = { version: adjusted.version, source }
  assert.equal((await request(`${path}/validate`, submission)).verdict, 'CHECKED')
  assert.equal((await request(`${path}/sample`, submission)).cases.length, 1)
  const passed = await request(`${path}/submit`, submission)
  assert.ok(passed.rounds[adjusted.current].submission.result.passed)
  assert.equal(passed.total, 2)
  assert.deepEqual(await request('/leaderboard'), [])
  const chosen = await request(`${path}/choose`, { version: passed.version, question: 'maze' })
  assert.equal(chosen.rounds[1].language, 'python')
  const second = await request(`${path}/submit`, { version: chosen.version, source })
  assert.equal(second.total, 4)
  assert.equal((await request('/records/best')).score, 0)
  const finished = await request(`${path}/abandon`, { version: second.version })
  const [record] = await request('/leaderboard')
  assert.ok(finished.finishedAt)
  assert.equal(record.score, 4)
  assert.deepEqual(
    record.rounds.map((round) => round.phase),
    ['passed', 'passed', 'abandoned'],
  )
  assert.equal((await request('/records/best')).score, 4)
  const [summary] = (await request('/admin/operations?all=1')).operations
  const detail = await request(`/admin${path}`)
  assert.equal(summary.submission.source, undefined)
  assert.equal(detail.submission.source, source)
})

test('宽限期内复用原局，已受理的提交判完后结算', async (t) => {
  const { request, moveDeadline, duringSubmit } = await fixture(t)
  const first = await request('/operations', start)
  const path = `/operations/${first.id}`
  const deadline = moveDeadline(first.id, submitGraceMs - 2000)
  assert.equal((await request('/operations', start)).id, first.id)
  await request(`${path}/sample`, { version: first.version, source }, 403)
  const operation = await duringSubmit(path, first.version, async () => {
    await delay(Math.max(0, Date.parse(deadline) + submitGraceMs + 50 - Date.now()))
    assert.deepEqual(await request('/leaderboard'), [])
    assert.equal((await request('/operations', start)).id, first.id)
  })
  assert.ok(operation.rounds[first.current].submission.result.passed && operation.finishedAt)
  assert.equal(operation.total, 1)
  assert.equal((await request('/records/best')).score, 1)
  assert.notEqual((await request('/operations', start)).id, first.id)
})

test('选题到点结算，作答在宽限结束后结算，允许重新开局', async (t) => {
  const { request, moveDeadline } = await fixture(t)
  const first = await request('/operations', start)
  const path = `/operations/${first.id}`
  const operation = await request(`${path}/submit`, { version: first.version, source })
  const deadline = moveDeadline(first.id, 1000)
  const finished = await request(path)
  assert.equal(finished.finishedAt, deadline)
  assert.equal(finished.rounds[operation.current].phase, 'expired')
  await request(`${path}/submit`, { version: finished.version, source }, 403)
  const [record] = await request('/leaderboard')
  assert.equal(record.durationMs, 3_600_000)
  assert.equal(record.score, 1)
  assert.equal((await request('/operations/current')).id, null)
  const next = await request('/operations', start)
  assert.notEqual(next.id, first.id)
  moveDeadline(next.id, submitGraceMs + 1000)
  assert.equal((await request(`/operations/${next.id}`)).rounds[0].phase, 'expired')
})

const deployed = process.env.DEPLOYMENT_URL
test('部署烟测：公开会话与跨域预检', { skip: !deployed }, async () => {
  const origin = process.env.DEPLOYMENT_ORIGIN || 'http://127.0.0.1:5173'
  const session = await fetch(`${deployed}/api/session`, { headers: { Origin: origin } })
  assert.equal(session.status, 200)
  assert.equal(session.headers.get('access-control-allow-origin'), origin)
  const response = await fetch(`${deployed}/api/operations`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  })
  assert.equal(response.status, 204)
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true')
  const denied = await fetch(`${deployed}/api/session`, { headers: { Origin: 'https://unlisted.invalid' } })
  assert.equal(denied.status, 403)
})
