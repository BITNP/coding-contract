import assert from 'node:assert/strict'
import { json } from 'node:stream/consumers'
import { test } from 'node:test'
import maze from '../server/questions/maze.js'
import { listen, startApi } from '../server/tests/http.js'

const answers = new Map(maze.cases.map(({ input, answer }) => [input, answer]))
const source = 'print(1)'
const answer = { source, question: maze.id }
// source-1 可由后端核验（1 分），ancient-1 需要线下核验（1 分）。
const manual = { language: 'python', indicators: ['source-1', 'ancient-1'] }
const automatic = { language: 'python', indicators: ['source-1'] }

async function fixture(t) {
  const judge = await listen(t, async (req, res) => {
    const {
      cmd: [cmd],
    } = await json(req)
    const stdout = cmd.args.includes('analyze.py')
      ? JSON.stringify({ bytes: Buffer.byteLength(cmd.copyIn['main.py'].content), codeLines: 1 })
      : answers.get(cmd.files[0].content) ?? 'wrong'
    res.end(JSON.stringify([{ status: 'Accepted', files: { stdout, stderr: '' }, time: 0, memory: 0 }]))
  })
  const { base } = await startApi(t, { ALLOW_GUEST: '1', JUDGE_URL: judge })
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
  async function start(selection = manual) {
    const { id } = await request('/operations', selection)
    return { id, path: `/operations/${id}` }
  }
  async function pass(path) {
    const { version } = await request(path)
    return request(`${path}/submit`, { version, ...answer })
  }
  return { base, request, start, pass }
}

test('含线下核验条款但未配对时只结算自动核验部分', async (t) => {
  const { request, start, pass } = await fixture(t)
  const { id, path } = await start()
  const opened = await request(path)
  assert.equal(opened.needsReferee, true)
  assert.equal(opened.automaticScore, 1)
  assert.match(opened.pairCode, /^[A-Z0-9]{4}$/)
  assert.equal((await request(`${path}/pairing`)).referee, null)

  const [pending] = (await request('/referee/operations')).operations
  assert.equal(pending.id, id)
  assert.equal(pending.pairCode, opened.pairCode)
  assert.equal(pending.mine, false)

  const passed = await pass(path)
  assert.equal(passed.phase, 'passed')
  assert.equal(passed.selectedScore, 2)
  assert.equal(passed.score, 1)
  assert.equal(passed.review, null)
  assert.equal(passed.pairCode, null)
  const [record] = await request('/leaderboard')
  assert.equal(record.score, 1)
  assert.equal((await request('/records/best')).score, 1)
})

test('配对后成绩需裁判确认，驳回则记零分', async (t) => {
  const { request, start, pass } = await fixture(t)
  const { id, path } = await start()
  const paired = await request(`/referee/operations/${id}/pair`, {})
  assert.equal(paired.referee.name, '访客')
  assert.equal(paired.mine, true)
  await request(`/referee/operations/${id}/pair`, {}, 409)
  assert.equal((await request(path)).referee.name, '访客')

  const passed = await pass(path)
  assert.equal(passed.phase, 'passed')
  assert.equal(passed.selectedScore, 2)
  assert.equal(passed.score, 0)
  assert.equal(passed.review.status, 'pending')
  assert.deepEqual(await request('/leaderboard'), [])
  assert.equal((await request(`${path}/pairing`)).review.status, 'pending')

  await request(`/referee/operations/${id}/review`, { decision: 'unknown' }, 400)
  const confirmed = await request(`/referee/operations/${id}/review`, { decision: 'confirmed' })
  assert.equal(confirmed.review.status, 'confirmed')
  assert.equal(confirmed.score, 2)
  assert.equal((await request(path)).score, 2)
  assert.equal((await request('/records/best')).score, 2)
  assert.equal((await request('/leaderboard'))[0].score, 2)
  await request(`/referee/operations/${id}/review`, { decision: 'confirmed' }, 409)
})

test('裁判驳回后成绩记零分且不上榜', async (t) => {
  const { request, start, pass } = await fixture(t)
  const { id, path } = await start()
  await request(`/referee/operations/${id}/pair`, {})
  assert.equal((await pass(path)).review.status, 'pending')
  const rejected = await request(`/referee/operations/${id}/review`, { decision: 'rejected' })
  assert.equal(rejected.review.status, 'rejected')
  assert.equal(rejected.score, 0)
  assert.deepEqual(await request('/leaderboard'), [])
  assert.equal((await request('/records/best')).score, 0)
})

test('已结束的作战不能配对，未通过的作战不能核验', async (t) => {
  const { request, start, pass } = await fixture(t)
  const finished = await pass((await start()).path)
  assert.equal(finished.review, null)
  await request(`/referee/operations/${finished.id}/pair`, {}, 409)

  const { id, path } = await start()
  await request(`/referee/operations/${id}/pair`, {})
  await request(`/referee/operations/${id}/review`, { decision: 'confirmed' }, 409)
  assert.equal((await request(path)).phase, 'active')
})

test('不含线下核验条款的作战不进入裁判端', async (t) => {
  const { request, start, pass } = await fixture(t)
  const { id, path } = await start(automatic)
  const opened = await request(path)
  assert.equal(opened.needsReferee, false)
  assert.equal(opened.pairCode, null)
  assert.equal(opened.automaticScore, 1)
  const passed = await pass(path)
  assert.equal(passed.score, 1)
  assert.equal(passed.selectedScore, 1)
  assert.equal(passed.review, null)
  assert.deepEqual((await request('/referee/operations')).operations, [])
  await request(`/referee/operations/${id}/pair`, {}, 400)
})
