import { Router } from 'express'
import { flaggedActivity } from '../shared/labels.js'
import { currentRound, roundSummary } from './operations.js'

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

export function createAdminRouter({ db, auth, admins = process.env.ADMIN_USERS }) {
  const allowed = new Set(
    (admins || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )
  const router = Router()
  const recent = db.prepare(
    `SELECT data FROM operations WHERE created_at >= ? AND (? OR finished_at IS NULL)
     ORDER BY created_at DESC`,
  )
  const byId = db.prepare('SELECT data FROM operations WHERE id = ?')

  router.use((req, res, next) => {
    if (!auth.available) return next()
    if (!req.user) return res.status(401).json({ message: '请先统一登录' })
    if (!allowed.has(req.user.id)) return res.status(403).json({ message: '无管理权限' })
    next()
  })

  function summarize(operation, now, detail = false) {
    const { events } = operation
    const flags = Object.fromEntries(flaggedActivity.map((type) => [type, 0]))
    for (const event of events) if (Object.hasOwn(flags, event.type)) flags[event.type]++
    const submission = operation.rounds.findLast((round) => round.submission)?.submission
    return {
      id: operation.id,
      user: operation.user,
      createdAt: operation.createdAt,
      deadline: operation.deadline,
      seenAt: operation.seenAt,
      online: now - Date.parse(operation.seenAt) < 60_000,
      running: !operation.finishedAt,
      current: operation.current,
      rounds: roundSummary(operation),
      language: currentRound(operation).language,
      score: operation.total,
      submission: submission
        ? {
            verdict: submission.result.verdict,
            score: submission.result.score,
            maxScore: submission.result.maxScore,
            language: submission.language,
            submittedAt: submission.submittedAt,
            ...(detail && { source: submission.source }),
          }
        : null,
      flags,
      awayMs: awayMs(events),
      ...(detail && { events, live: operation.live }),
    }
  }

  router.get('/operations', (req, res) => {
    const now = Date.now()
    const operations = recent
      .all(new Date(now - window24h).toISOString(), Number(req.query.all === '1'))
      .map((row) => summarize(JSON.parse(row.data), now))
    res.json({ serverTime: now, operations })
  })

  router.get('/operations/:id', (req, res) => {
    const row = byId.get(req.params.id)
    if (!row) return res.status(404).json({ message: '未找到这次作战' })
    res.json(summarize(JSON.parse(row.data), Date.now(), true))
  })

  return router
}
