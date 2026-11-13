import express from 'express'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { login } from './auth.js'
import { question } from './question.js'
import { evaluate } from './judge.js'
import { contractById, selectionErrors } from '../shared/contracts.js'

const envFile = fileURLToPath(new URL('./.env', import.meta.url))
if (existsSync(envFile)) process.loadEnvFile(envFile)

const dataPath = process.env.DATA_DIR || fileURLToPath(new URL('./data/', import.meta.url))
mkdirSync(dataPath, { recursive: true })

const db = new DatabaseSync(`${dataPath}/pioneer.db`)
db.exec(`
  CREATE TABLE IF NOT EXISTS records (user_id TEXT PRIMARY KEY, score INTEGER DEFAULT 0, updated_at TEXT);
  CREATE TABLE IF NOT EXISTS operations (id TEXT PRIMARY KEY, user_id TEXT, data TEXT)
`)

const sessions = new Map()
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

app.use((req, res, next) => {
  const sid = /(?:^|; )pioneer_session=([^;]+)/.exec(req.headers.cookie || '')?.[1]
  req.user = sessions.get(sid)?.user || null
  req.sid = sid
  next()
})

const owner = (req) => req.user?.id || 'preview'
const cookieOptions = (req) => ({
  httpOnly: true,
  sameSite: process.env.COOKIE_SAME_SITE || 'lax',
  secure: process.env.COOKIE_SAME_SITE === 'none' || req.secure,
})

app.get('/api/session', (req, res) =>
  res.json({ user: req.user, authAvailable: Boolean(process.env.AUTH_API_URL) }),
)

app.post('/api/auth/login', async (req, res) => {
  const result = await login(req.body)
  if (!result) return res.status(503).json({ message: '账号服务即将开放，当前可使用访客体验。' })

  const sid = randomUUID()
  sessions.set(sid, result)
  res.cookie('pioneer_session', sid, {
    ...cookieOptions(req),
    maxAge: 86400000,
  })
  res.json({ user: result.user })
})

app.post('/api/auth/logout', (req, res) => {
  sessions.delete(req.sid)
  res.clearCookie('pioneer_session', cookieOptions(req)).json({ ok: true })
})

app.get('/api/records/best', (req, res) => {
  res.json(
    db.prepare('SELECT score, updated_at AS updatedAt FROM records WHERE user_id = ?').get(owner(req)) || {
      score: 0,
      updatedAt: null,
    },
  )
})

const operationResponse = (operation) => ({
  ...operation,
  question: { ...question, score: operation.question.score, contracts: operation.question.contracts },
})

app.post('/api/operations', async (req, res) => {
  if (process.env.AUTH_API_URL && !req.user) return res.status(401).json({ message: '请先登录后开始作战' })
  const { indicators, language = 'cpp' } = req.body
  const errors = selectionErrors(indicators, language)
  if (errors.length) return res.status(400).json({ message: errors.join('；') })

  const score = indicators.reduce((sum, id) => sum + contractById[id].points, 0)
  const operation = {
    id: randomUUID(),
    language,
    createdAt: new Date().toISOString(),
    question: { score, contracts: indicators },
  }

  db.prepare('INSERT INTO operations VALUES (?, ?, ?)').run(
    operation.id,
    owner(req),
    JSON.stringify(operation),
  )

  res.json(operationResponse(operation))
})

app.get('/api/operations/:id', (req, res) => {
  const row = db
    .prepare('SELECT data FROM operations WHERE id = ? AND user_id = ?')
    .get(req.params.id, owner(req))
  if (!row) return res.status(404).json({ message: '未找到这次作战，请返回重新开始。' })

  res.json(operationResponse(JSON.parse(row.data)))
})

function recordBestScore(userId, score) {
  db.prepare(
    'INSERT INTO records VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET score = max(records.score, excluded.score), updated_at = excluded.updated_at',
  ).run(userId, score, new Date().toISOString())
}

for (const action of ['validate', 'sample', 'submit']) {
  app.post(`/api/operations/:id/${action}`, async (req, res) => {
    const row = db
      .prepare('SELECT data FROM operations WHERE id = ? AND user_id = ?')
      .get(req.params.id, owner(req))
    if (!row) return res.status(404).json({ message: '未找到这次作战' })

    const operation = JSON.parse(row.data)
    const { source, language = operation.language } = req.body

    // 每次都重新检查、分析、运行，词条和分值取自服务端保存的作战配置。
    const result = await evaluate({
      source,
      language,
      indicators: operation.question.contracts,
      mode: action,
    })

    if (action === 'submit') {
      operation.submission = { source, language, result, submittedAt: new Date().toISOString() }
      db.prepare('UPDATE operations SET data = ? WHERE id = ?').run(JSON.stringify(operation), operation.id)
      if (result.verdict === 'AC') recordBestScore(owner(req), result.score)
    }

    res.json(result)
  })
}

app.use((_req, res) => res.status(404).json({ message: '未找到 API' }))

app.use((error, req, res, _next) =>
  res.status(error.status || 500).json({ message: error.message || '服务暂时不可用' }),
)

app.listen(process.env.PORT || 3001, process.env.HOST || '127.0.0.1', () =>
  console.log(`API: http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 3001}`),
)
