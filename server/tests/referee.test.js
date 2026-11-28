import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import express from 'express'
import { openDatabase } from '../database.js'
import { createOperation, finishOperation } from '../operations.js'
import { createRefereeRouter } from '../referee.js'
import { listen } from './http.js'

const source = 'print(1)'
// source-1 自动核验（1 分）+ ancient-1 需线下核验（1 分）。
const manual = { language: 'python', indicators: ['source-1', 'ancient-1'] }

test('多个裁判共享全局列表，但只能核验自己接入的选手', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'pioneer-referee-'))
  const db = openDatabase(dir)
  t.after(async () => {
    db.close()
    await rm(dir, { recursive: true, force: true })
  })
  const player = { id: 'alice', name: 'Alice', avatar: null }
  const insert = db.prepare('INSERT INTO operations (id, user_id, data) VALUES (?, ?, ?)')
  const active = createOperation({
    id: 'op-active',
    language: 'python',
    indicators: manual.indicators,
    user: player,
    now: Date.now(),
  })
  insert.run(active.id, player.id, JSON.stringify(active))
  const finished = createOperation({
    id: 'op-done',
    language: 'python',
    indicators: manual.indicators,
    user: player,
    now: Date.now() - 60_000,
  })
  finished.referee = { id: 'ref-a', name: '裁判 A' }
  finished.submission = {
    question: 'maze',
    language: 'python',
    source,
    contracts: manual.indicators,
    submittedAt: new Date().toISOString(),
    result: { verdict: 'AC', passed: true, checks: [], cases: [] },
  }
  finishOperation(finished, 'passed', new Date().toISOString())
  insert.run(finished.id, player.id, JSON.stringify(finished))

  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    const id = req.get('x-user')
    req.user = id ? { id, name: id, avatar: null } : null
    next()
  })
  app.use(
    '/api/referee',
    createRefereeRouter({ db, auth: { available: true }, roster: new Set(['ref-a', 'ref-b']) }),
  )
  app.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({ message: error.message })
  })
  const base = await listen(t, app)
  async function call(who, path, body) {
    const response = await fetch(`${base}/api/referee${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(who && { 'x-user': who }) },
      body: JSON.stringify(body),
    })
    return { status: response.status, data: await response.json() }
  }

  assert.equal((await call(null, '/operations')).status, 401)
  assert.equal((await call('ref-c', '/operations')).status, 403)
  assert.equal((await call('ref-a', '/operations')).status, 200)

  const paired = await call('ref-a', `/operations/${active.id}/pair`, {})
  assert.equal(paired.status, 200)
  assert.equal(paired.data.mine, true)
  const other = await call('ref-b', `/operations/${active.id}`)
  assert.equal(other.status, 200)
  assert.equal(other.data.referee.name, 'ref-a')
  assert.equal(other.data.mine, false)
  const list = await call('ref-b', '/operations')
  assert.ok(list.data.operations.some((item) => item.id === active.id && item.mine === false))
  assert.equal((await call('ref-b', `/operations/${active.id}/pair`, {})).status, 409)
  assert.equal((await call('ref-b', `/operations/${active.id}/review`, { decision: 'confirmed' })).status, 403)

  assert.equal((await call('ref-b', `/operations/${finished.id}/review`, { decision: 'confirmed' })).status, 403)
  const confirmed = await call('ref-a', `/operations/${finished.id}/review`, { decision: 'confirmed' })
  assert.equal(confirmed.status, 200)
  assert.equal(confirmed.data.score, 2)
  assert.equal(confirmed.data.mine, true)
})
