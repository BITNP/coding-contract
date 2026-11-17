import { Router } from 'express'
import { contractById, submitGraceMs } from '../shared/contracts.js'

const flagged = ['fullscreen-exit', 'hidden', 'blur', 'paste', 'devtools']
const window24h = 24 * 60 * 60 * 1000

function awayMs(events) {
  const spans = events
    .filter((event) => (event.type === 'visible' || event.type === 'focus') && event.detail > 0)
    .map((event) => [event.at - event.detail, event.at])
    .sort((a, b) => a[0] - b[0])
  let total = 0
  let end = -Infinity
  for (const [from, to] of spans) {
    total += Math.max(0, to - Math.max(from, end))
    end = Math.max(end, to)
  }
  return total
}

export function createAdminRouter({ db, auth, question, admins = process.env.ADMIN_USERS }) {
  const allowed = new Set(
    (admins || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )
  const router = Router()
  const recent = db.prepare(
    `SELECT user_id, data FROM operations
     WHERE json_extract(data, '$.createdAt') >= ?1 OR json_extract(data, '$.seenAt') >= ?1
     ORDER BY json_extract(data, '$.createdAt') DESC`,
  )
  const byId = db.prepare('SELECT user_id, data FROM operations WHERE id = ?')

  router.use((req, res, next) => {
    if (!auth.available) return next()
    if (!req.user) return res.status(401).json({ message: '请先统一登录' })
    if (!allowed.has(req.user.id) && !allowed.has(req.user.name))
      return res.status(403).json({ message: '无管理权限' })
    next()
  })

  function summarize(operation, owner, now) {
    const events = operation.events || []
    const seen = Date.parse(operation.seenAt) || 0
    const deadline = Date.parse(operation.deadline)
    const flags = Object.fromEntries(flagged.map((type) => [type, 0]))
    for (const event of events) if (Object.hasOwn(flags, event.type)) flags[event.type]++
    const { submission } = operation
    return {
      id: operation.id,
      user: {
        id: operation.user?.id || owner,
        name: operation.user?.name || owner,
        avatar: operation.user?.avatar || null,
      },
      createdAt: operation.createdAt,
      deadline: operation.deadline || null,
      seenAt: operation.seenAt || null,
      online: now - seen < 60_000,
      running: deadline ? now <= deadline + submitGraceMs : now - seen < 120_000,
      question: question.title,
      language: operation.language,
      contracts: operation.question.contracts
        .filter((id) => Object.hasOwn(contractById, id))
        .map((id) => ({ id, name: contractById[id].name, points: contractById[id].points })),
      score: operation.question.score,
      submission: submission
        ? {
            verdict: submission.result?.verdict,
            score: submission.result?.score,
            maxScore: submission.result?.maxScore,
            language: submission.language,
            submittedAt: submission.submittedAt,
          }
        : null,
      flags,
      awayMs: awayMs(events),
      live: operation.live || null,
    }
  }

  router.get('/operations', (req, res) => {
    const now = Date.now()
    const since = now - window24h
    const operations = recent
      .all(new Date(since).toISOString())
      .map((row) => summarize(JSON.parse(row.data), row.user_id, now))
      .filter((item) => item.running || (req.query.all === '1' && Date.parse(item.createdAt) >= since))
    res.json({ serverTime: now, operations })
  })

  router.get('/operations/:id', (req, res) => {
    const row = byId.get(req.params.id)
    if (!row) return res.status(404).json({ message: '未找到这次作战' })
    const operation = JSON.parse(row.data)
    const item = summarize(operation, row.user_id, Date.now())
    res.json({
      ...item,
      events: operation.events || [],
      submission: item.submission && { ...item.submission, source: operation.submission.source },
    })
  })

  return router
}
