import express from 'express'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { authConfig, createAuth } from './auth.js'
import { createAdminRouter } from './admin.js'
import { leaderboard, rankingOrder } from './leaderboard.js'
import { questions } from './questions/index.js'
import { evaluate } from './judge.js'
import { openDatabase, transaction } from './database.js'
import { closed, conclude, createOperation, currentRound, operationView, expire } from './operations.js'
import { adjustContracts, selectionErrors, submitGraceMs } from '../shared/contracts.js'
import { activityLabels } from '../shared/labels.js'
import { languageById } from '../shared/languages.js'

const envFile = fileURLToPath(new URL('./.env', import.meta.url))
if (existsSync(envFile)) process.loadEnvFile(envFile)

const auth = createAuth(authConfig())
const db = openDatabase()
const app = express()
const origins = new Set(
  (process.env.CORS_ORIGINS ?? 'http://127.0.0.1:5173,http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)

app.use((req, res, next) => {
  res.vary('Origin')
  const origin = req.get('Origin')
  if (origin) {
    if (!origins.has(origin)) return res.status(403).json({ message: '未允许此站点访问 API' })
    res.set('Access-Control-Allow-Origin', origin)
    res.set('Access-Control-Allow-Credentials', 'true')
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.set('Access-Control-Allow-Headers', 'Content-Type')
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.use(express.json())

app.use(auth.authenticate)
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

const statements = {
  best: db.prepare(`SELECT score, finished_at AS updatedAt FROM operations
    WHERE user_id = ? AND finished_at IS NOT NULL ORDER BY ${rankingOrder} LIMIT 1`),
  insert: db.prepare('INSERT INTO operations (id, user_id, data) VALUES (?, ?, ?)'),
  find: db.prepare('SELECT data FROM operations WHERE id = ? AND user_id = ?'),
  active: db.prepare('SELECT id FROM operations WHERE user_id = ? AND finished_at IS NULL'),
  due: db.prepare(`SELECT data FROM operations WHERE finished_at IS NULL AND deadline < ?
    AND (deadline < ? OR json_extract(data, '$.rounds[' || (data ->> '$.current') || '].phase') = 'choosing')`),
  update: db.prepare('UPDATE operations SET data = ? WHERE id = ?'),
}
const judging = new Map()
const guest = { id: 'preview', name: '访客', avatar: null }
const user = (req) => req.user || guest
const fail = (status, message) => Object.assign(new Error(message), { status })

function findOperation(id, owner) {
  const row = statements.find.get(id, owner)
  if (!row) throw fail(404, '未找到这次作战')
  return JSON.parse(row.data)
}

function save(operation) {
  statements.update.run(JSON.stringify(operation), operation.id)
}

function settleExpired() {
  const now = Date.now()
  const deadlines = [new Date(now).toISOString(), new Date(now - submitGraceMs).toISOString()]
  if (!statements.due.get(...deadlines)) return
  transaction(db, () => {
    for (const { data } of statements.due.all(...deadlines)) {
      const operation = JSON.parse(data)
      if (judging.get(operation.id) === operation.version) continue
      expire(operation)
      operation.version++
      save(operation)
    }
  })
}

setInterval(() => {
  try {
    settleExpired()
  } catch (error) {
    console.error(error)
  }
}, 5000).unref()

app.use('/api/auth', auth.router)
app.get('/api/session', (req, res) => res.json({ user: req.user, authAvailable: auth.available }))
app.use('/api/operations', auth.requireUser)
app.use('/api/records', auth.requireUser)
app.use('/api', (_req, _res, next) => {
  settleExpired()
  next()
})
app.use('/api/leaderboard', leaderboard(db))
app.use('/api/admin', createAdminRouter({ db, auth }))

app.get('/api/records/best', (req, res) => {
  res.json(statements.best.get(user(req).id) || { score: 0, updatedAt: null })
})

app.use('/api/operations', (req, _res, next) => {
  if (req.method === 'POST' && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)))
    throw fail(400, '请求体必须是 JSON 对象')
  next()
})

function checkSelection(indicators, language) {
  const errors = selectionErrors(indicators, language)
  if (errors.length) throw fail(400, errors.join('；'))
}

app.post('/api/operations', (req, res) => {
  const { indicators, language } = req.body
  checkSelection(indicators, language)
  const owner = user(req)
  const operation = transaction(db, () => {
    const active = statements.active.get(owner.id)
    if (active) return findOperation(active.id, owner.id)
    const operation = createOperation({
      id: randomUUID(),
      language,
      indicators,
      user: owner,
      now: Date.now(),
    })
    statements.insert.run(operation.id, owner.id, JSON.stringify(operation))
    return operation
  })
  res.json(operationView(operation))
})

app.get('/api/operations/current', (req, res) => {
  res.json(statements.active.get(user(req).id) || { id: null })
})

app.get('/api/operations/:id', (req, res) => {
  res.json(operationView(findOperation(req.params.id, user(req).id)))
})

function updateOperation(req, change) {
  return transaction(db, () => {
    const operation = findOperation(req.params.id, user(req).id)
    change(operation)
    save(operation)
    return operation
  })
}

function validEvent(event) {
  return (
    typeof event?.type === 'string' &&
    Object.hasOwn(activityLabels, event.type) &&
    Number.isFinite(event.at) &&
    Number.isFinite(new Date(event.at).getTime()) &&
    (event.detail === undefined || (Number.isFinite(event.detail) && event.detail >= 0))
  )
}

app.post('/api/operations/:id/activity', (req, res) => {
  const { events, snapshot } = req.body
  if (!Array.isArray(events) || events.length > 200 || !events.every(validEvent))
    throw fail(400, '行为事件格式有误')
  if (
    snapshot !== undefined &&
    (typeof snapshot?.source !== 'string' ||
      typeof snapshot.language !== 'string' ||
      !Object.hasOwn(languageById, snapshot.language))
  )
    throw fail(400, '代码快照格式有误')
  const now = Date.now()
  const accepted = events.map(({ type, at, detail }) => ({ type, at, receivedAt: now, detail }))
  updateOperation(req, (operation) => {
    operation.events = operation.events.concat(accepted).slice(-2000)
    operation.seenAt = new Date(now).toISOString()
    if (snapshot)
      operation.live = {
        language: snapshot.language,
        source: snapshot.source.slice(0, 65536),
        at: operation.seenAt,
      }
  })
  res.json({ accepted: accepted.length })
})

function checkRound(operation, version, phases, grace = 0, now = Date.now()) {
  if (!Number.isSafeInteger(version) || version < 0) throw fail(400, '缺少有效的作战版本')
  if (operation.version !== version) throw fail(409, '回合状态已变化，请刷新页面')
  if (closed(operation, grace, now)) throw fail(403, '作战已结束')
  const round = currentRound(operation)
  if (!phases.includes(round.phase)) throw fail(409, '当前回合无法执行此操作')
  return round
}

function roundAction(phases, act) {
  return (req, res) => {
    const operation = updateOperation(req, (operation) => {
      const round = checkRound(operation, req.body.version, phases)
      act(operation, round, req.body)
      operation.version++
    })
    res.json(operationView(operation))
  }
}

app.post(
  '/api/operations/:id/choose',
  roundAction(['choosing'], (_operation, round, { question }) => {
    if (!round.choices.includes(question)) throw fail(400, '该题目不在本回合的可选范围内')
    Object.assign(round, { question, phase: 'active' })
  }),
)

app.post(
  '/api/operations/:id/contracts',
  roundAction(['choosing', 'active'], (_operation, round, { indicators, language }) => {
    checkSelection(indicators, language)
    Object.assign(round, { contracts: adjustContracts(round.contracts, indicators), language })
  }),
)

app.post(
  '/api/operations/:id/abandon',
  roundAction(['choosing', 'active'], (operation) => {
    conclude(operation, { phase: 'abandoned', score: 0 }, new Date().toISOString())
  }),
)

for (const mode of ['validate', 'sample', 'submit']) {
  app.post(`/api/operations/:id/${mode}`, async (req, res) => {
    const { version, source } = req.body
    const received = Date.now()
    const operation = findOperation(req.params.id, user(req).id)
    const submitted = mode === 'submit'
    const grace = submitted ? submitGraceMs : 0
    const { contracts, language, question } = checkRound(operation, version, ['active'], grace, received)
    if (submitted && judging.get(operation.id) === version) throw fail(409, '提交正在评测')
    if (submitted) judging.set(operation.id, version)
    try {
      const result = await evaluate({
        source,
        language,
        indicators: contracts,
        question: questions[question],
        mode,
      })
      if (!submitted) {
        checkRound(findOperation(req.params.id, user(req).id), version, ['active'], 0, received)
        return res.json(result)
      }
      const latest = updateOperation(req, (latest) => {
        const round = checkRound(latest, version, ['active'], grace, received)
        const submittedAt = new Date(received).toISOString()
        round.submission = { source, language, contracts, result, submittedAt }
        if (result.passed) conclude(latest, { phase: 'passed', score: result.score }, submittedAt, Date.now())
        else if (Date.now() >= Date.parse(latest.deadline)) expire(latest)
        latest.version++
      })
      res.json(operationView(latest))
    } finally {
      if (submitted && judging.get(operation.id) === version) judging.delete(operation.id)
    }
  })
}

app.use((_req, res) => res.status(404).json({ message: '未找到 API' }))

app.use((error, _req, res, _next) => {
  const status = error.status || 500
  if (status >= 500) console.error(error)
  res.status(status).json({ message: status >= 500 ? '服务暂时不可用' : error.message })
})

const server = app.listen(process.env.PORT || 3001, process.env.HOST || '127.0.0.1', () =>
  console.log(`API: http://${process.env.HOST || '127.0.0.1'}:${server.address().port}`),
)
