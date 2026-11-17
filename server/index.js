import express from 'express'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { authConfig, createAuth } from './auth.js'
import { createAdminRouter } from './admin.js'
import { leaderboard } from './leaderboard.js'
import { question } from './question.js'
import { evaluate } from './judge.js'
import { contractById, selectionErrors, submitGraceMs, timeLimit } from '../shared/contracts.js'
import { languages } from '../shared/languages.js'

const envFile = fileURLToPath(new URL('./.env', import.meta.url))
if (existsSync(envFile)) process.loadEnvFile(envFile)

const dataPath = process.env.DATA_DIR || fileURLToPath(new URL('./data/', import.meta.url))
mkdirSync(dataPath, { recursive: true })

const db = new DatabaseSync(`${dataPath}/pioneer.db`)
db.exec(`
  CREATE TABLE IF NOT EXISTS records (user_id TEXT PRIMARY KEY, score INTEGER DEFAULT 0, updated_at TEXT);
  CREATE TABLE IF NOT EXISTS operations (id TEXT PRIMARY KEY, user_id TEXT, data TEXT)
`)
const recordColumns = new Set(db.prepare('PRAGMA table_info(records)').all().map((column) => column.name))
for (const column of ['name TEXT', 'avatar TEXT', 'language TEXT', 'duration_ms INTEGER'])
  if (!recordColumns.has(column.split(' ')[0])) db.exec(`ALTER TABLE records ADD COLUMN ${column}`)

const auth = createAuth(authConfig())
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
app.use('/api/auth', auth.router)
app.use('/api/leaderboard', leaderboard(db))
app.use('/api/operations', auth.requireUser)
app.use('/api/records', auth.requireUser)

const owner = (req) => req.user?.id || 'preview'

app.get('/api/session', (req, res) =>
  res.json({ user: req.user, authAvailable: auth.available }),
)

app.get('/api/records/best', (req, res) => {
  res.json(
    db.prepare('SELECT score, updated_at AS updatedAt FROM records WHERE user_id = ?').get(owner(req)) || {
      score: 0,
      updatedAt: null,
    },
  )
})

const knownContracts = (ids) => ids.filter((id) => Object.hasOwn(contractById, id))

const operationResponse = ({ events, live, seenAt, ...operation }) => ({
  ...operation,
  serverTime: Date.now(),
  question: {
    ...question,
    score: operation.question.score,
    contracts: knownContracts(operation.question.contracts),
  },
})

app.post('/api/operations', async (req, res) => {
  const { indicators, language = 'cpp' } = req.body
  const errors = selectionErrors(indicators, language)
  if (errors.length) return res.status(400).json({ message: errors.join('；') })

  const score = indicators.reduce((sum, id) => sum + contractById[id].points, 0)
  const now = Date.now()
  const operation = {
    id: randomUUID(),
    language,
    createdAt: new Date(now).toISOString(),
    deadline: new Date(now + timeLimit(indicators) * 60_000).toISOString(),
    user: req.user
      ? { id: req.user.id, name: req.user.name, avatar: req.user.avatar || null }
      : { id: owner(req), name: '访客', avatar: null },
    question: { score, contracts: indicators },
  }

  db.prepare('INSERT INTO operations VALUES (?, ?, ?)').run(
    operation.id,
    owner(req),
    JSON.stringify(operation),
  )

  res.json(operationResponse(operation))
})

function findOperation(req) {
  const row = db
    .prepare('SELECT data FROM operations WHERE id = ? AND user_id = ?')
    .get(req.params.id, owner(req))
  return row && JSON.parse(row.data)
}

function updateOperation(req, change) {
  const operation = findOperation(req)
  change(operation)
  db.prepare('UPDATE operations SET data = ? WHERE id = ?').run(JSON.stringify(operation), operation.id)
}

app.get('/api/operations/:id', (req, res) => {
  const operation = findOperation(req)
  if (!operation) return res.status(404).json({ message: '未找到这次作战，请返回重新开始。' })
  res.json(operationResponse(operation))
})

const activityTypes = new Set([
  'open',
  'leave',
  'fullscreen-enter',
  'fullscreen-exit',
  'hidden',
  'visible',
  'blur',
  'focus',
  'paste',
  'devtools',
])
const languageIds = new Set(languages.map((language) => language.id))

app.post('/api/operations/:id/activity', (req, res) => {
  if (!findOperation(req)) return res.status(404).json({ message: '未找到这次作战' })
  const now = Date.now()
  const { events, snapshot } = req.body
  const accepted = (Array.isArray(events) ? events.slice(0, 200) : [])
    .filter((event) => activityTypes.has(event?.type))
    .map(({ type, at, detail }) => ({
      type,
      at: Number.isFinite(at) ? at : now,
      receivedAt: now,
      ...(Number.isFinite(detail) && { detail }),
    }))
  updateOperation(req, (operation) => {
    operation.events = [...(operation.events || []), ...accepted].slice(-2000)
    operation.seenAt = new Date(now).toISOString()
    if (typeof snapshot?.source === 'string' && languageIds.has(snapshot.language))
      operation.live = {
        source: snapshot.source.slice(0, 65536),
        language: snapshot.language,
        at: new Date(now).toISOString(),
      }
  })
  res.json({ accepted: accepted.length })
})

function recordBestScore(req, operation, submission) {
  const { name = '访客', avatar = null } = req.user || operation.user || {}
  db.prepare(
    `INSERT INTO records (user_id, score, updated_at, name, avatar, language, duration_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET score = excluded.score,
      updated_at = excluded.updated_at, name = excluded.name, avatar = excluded.avatar,
      language = excluded.language, duration_ms = excluded.duration_ms
    WHERE excluded.score > records.score OR excluded.score = records.score
      AND (records.duration_ms IS NULL OR excluded.duration_ms < records.duration_ms)`,
  ).run(
    owner(req),
    submission.result.score,
    submission.submittedAt,
    name,
    avatar,
    submission.language,
    Date.parse(submission.submittedAt) - Date.parse(operation.createdAt),
  )
}

for (const action of ['validate', 'sample', 'submit']) {
  app.post(`/api/operations/:id/${action}`, async (req, res) => {
    const operation = findOperation(req)
    if (!operation) return res.status(404).json({ message: '未找到这次作战' })

    const { source, language = operation.language } = req.body
    const overdue = operation.deadline && Date.now() - Date.parse(operation.deadline)
    if (overdue > (action === 'submit' ? submitGraceMs : 0))
      return res.status(403).json({ message: '作战时限已到，无法继续提交' })

    // 每次都重新检查、分析、运行，词条和分值取自服务端保存的作战配置。
    const result = await evaluate({
      source,
      language,
      indicators: knownContracts(operation.question.contracts),
      mode: action,
    })

    if (action === 'submit') {
      const submission = { source, language, result, submittedAt: new Date().toISOString() }
      updateOperation(req, (latest) => (latest.submission = submission))
      if (result.verdict === 'AC') recordBestScore(req, operation, submission)
    }

    res.json(result)
  })
}

app.use('/api/admin', createAdminRouter({ db, auth, question }))

app.use((_req, res) => res.status(404).json({ message: '未找到 API' }))

app.use((error, req, res, _next) =>
  res.status(error.status || 500).json({ message: error.message || '服务暂时不可用' }),
)

const server = app.listen(process.env.PORT || 3001, process.env.HOST || '127.0.0.1', () =>
  console.log(`API: http://${process.env.HOST || '127.0.0.1'}:${server.address().port}`),
)
