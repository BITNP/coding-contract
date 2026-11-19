import assert from 'node:assert/strict'
import { json } from 'node:stream/consumers'
import { test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { openDatabase } from '../server/database.js'
import maxRise from '../server/questions/max-rise.js'
import maze from '../server/questions/maze.js'
import { submitGraceMs } from '../shared/contracts.js'
import { listen, startApi } from '../server/tests/http.js'

const answers = new Map([...maxRise.cases, ...maze.cases].map(({ input, answer }) => [input, answer]))
const start = { language: 'python', indicators: ['source-1'] }
const source = 'print(1)'
const answer = { source, question: 'max-rise' }

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
      stdout = cmd.copyIn['main.py'].content === source ? answers.get(cmd.files[0].content) : 'wrong'
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
    const db = openDatabase(dir)
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
    const submission = request(`${path}/submit`, { version, ...answer }, status)
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

test('作战复用活动局，三道题均可查看，放弃后直接结束', async (t) => {
  const { base, request } = await fixture(t)
  assert.equal((await fetch(base)).status, 404)
  assert.equal((await fetch(`${base}/app.js`)).status, 404)
  assert.equal((await fetch(`${base}/api/operations`, { method: 'POST' })).status, 400)
  await request('/operations', {}, 400)
  await request('/operations', { indicators: [] }, 400)
  const [first, again] = await Promise.all([request('/operations', start), request('/operations', start)])
  assert.equal(again.id, first.id)
  assert.deepEqual(first.questions.map((q) => q.id).sort(), ['channel-schedule', 'max-rise', 'maze'])
  assert.ok(first.questions.every((q) => q.content && !('cases' in q)))
  const path = `/operations/${first.id}`
  const { version } = first
  assert.deepEqual(await request('/operations/current'), { id: first.id })
  await request(`${path}/contracts`, { version, language: 'python' }, 400)
  await request(`${path}/contracts`, { version, indicators: [] }, 400)
  await request(`${path}/sample`, { version, source }, 400)
  await request(`${path}/validate`, { version, source, question: ['maze'] }, 400)
  await request(`${path}/submit`, { version, source, question: 'constructor' }, 400)
  await request(`${path}/submit`, { version, question: 'maze' }, 400)
  await request(`${path}/abandon`, {}, 400)
  assert.deepEqual((await request(path)).contracts, ['source-1'])
  const finished = await request(`${path}/abandon`, { version })
  await request(`${path}/abandon`, { version }, 409)
  assert.equal(finished.phase, 'abandoned')
  assert.equal(finished.score, 0)
  assert.equal((await request('/operations/current')).id, null)
})

test('拒绝过期评测，答错后可换题，任意一题通过即按当前指标结算', async (t) => {
  const { request, duringSubmit } = await fixture(t)
  const first = await request('/operations', start)
  const path = `/operations/${first.id}`
  const change = { version: first.version, language: 'python', indicators: ['source-2'] }
  await duringSubmit(
    path,
    first.version,
    async () => {
      await request(`${path}/submit`, { version: first.version, ...answer }, 409)
      await request(`${path}/contracts`, change)
    },
    409,
  )
  const { version, submission } = await request(path)
  assert.equal(submission, undefined)
  const failed = await request(`${path}/submit`, { version, ...answer, source: 'print(0)' })
  assert.equal(failed.phase, 'active')
  assert.equal(failed.submission.result.verdict, 'WA')
  assert.equal(failed.submission.question, 'max-rise')
  assert.deepEqual(await request('/leaderboard'), [])

  const next = { version: failed.version, source, question: 'maze' }
  const snapshot = { source, language: 'python', question: 'maze' }
  await request(`${path}/activity`, { events: [], snapshot: { source, language: 'python' } }, 400)
  await request(`${path}/activity`, { events: [], snapshot })
  assert.equal((await request(`/admin${path}`)).live.question, maze.title)
  assert.equal((await request(`${path}/validate`, next)).verdict, 'CHECKED')
  assert.equal((await request(`${path}/sample`, next)).cases.length, 1)
  const passed = await request(`${path}/submit`, next)
  assert.equal(passed.phase, 'passed')
  assert.equal(passed.score, 2)
  assert.equal(passed.submission.question, 'maze')
  assert.equal(passed.submission.result.totalCases, maze.cases.length)
  await request(`${path}/submit`, { ...next, version: passed.version, question: 'max-rise' }, 403)
  const [record] = await request('/leaderboard')
  assert.equal(record.question, maze.title)
  assert.deepEqual(record.contracts, change.indicators)
  assert.equal(record.score, 2)
  assert.equal((await request('/records/best')).score, 2)
  const [summary] = (await request('/admin/operations?all=1')).operations
  const detail = await request(`/admin${path}`)
  assert.equal(summary.question, maze.title)
  assert.equal(summary.submission.source, undefined)
  assert.equal(detail.submission.source, source)
  assert.equal(detail.submission.question, maze.title)
})

test('宽限期内复用原局，已受理的提交判完后结算', async (t) => {
  const { request, moveDeadline, duringSubmit } = await fixture(t)
  const first = await request('/operations', start)
  const path = `/operations/${first.id}`
  const deadline = moveDeadline(first.id, submitGraceMs - 2000)
  assert.equal((await request('/operations', start)).id, first.id)
  await request(`${path}/sample`, { version: first.version, ...answer }, 403)
  const passed = await duringSubmit(path, first.version, async () => {
    await delay(Math.max(0, Date.parse(deadline) + submitGraceMs + 50 - Date.now()))
    assert.deepEqual(await request('/leaderboard'), [])
    assert.equal((await request('/operations', start)).id, first.id)
  })
  assert.equal(passed.finishedAt, deadline)
  assert.equal(passed.score, 1)
  assert.equal((await request('/leaderboard'))[0].durationMs, 3_600_000)
})

test('超时按零分结算，可重新开局', async (t) => {
  const { request, moveDeadline } = await fixture(t)
  const first = await request('/operations', start)
  const path = `/operations/${first.id}`
  const deadline = moveDeadline(first.id, submitGraceMs + 1000)
  const finished = await request(path)
  assert.equal(finished.finishedAt, deadline)
  assert.equal(finished.phase, 'expired')
  assert.equal(finished.score, 0)
  await request(`${path}/submit`, { version: finished.version, ...answer }, 403)
  assert.deepEqual(await request('/leaderboard'), [])
  assert.notEqual((await request('/operations', start)).id, first.id)
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
