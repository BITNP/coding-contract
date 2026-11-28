import { Router } from 'express'
import { questions } from './questions/index.js'
import { awayMs, flaggedCounts } from './activity.js'
import { mayAdmin } from './auth.js'

const window24h = 24 * 60 * 60 * 1000

export function createAdminRouter({ db, auth }) {
  const router = Router()
  const recent = db.prepare(
    `SELECT data FROM operations WHERE created_at >= ? AND (? OR finished_at IS NULL)
     ORDER BY created_at DESC`,
  )
  const byId = db.prepare('SELECT data FROM operations WHERE id = ?')

  router.use((req, res, next) => {
    if (!auth.available) return next()
    if (!req.user) return res.status(401).json({ message: '请先统一登录' })
    if (!mayAdmin(auth, req.user)) return res.status(403).json({ message: '无管理权限' })
    next()
  })

  function summarize(operation, now, detail = false) {
    const { events, submission, live } = operation
    const flags = flaggedCounts(events)
    const current =
      !submission || (!operation.finishedAt && live?.at > submission.submittedAt) ? live : submission
    const settings = operation.finishedAt && submission ? submission : operation
    return {
      id: operation.id,
      user: operation.user,
      createdAt: operation.createdAt,
      deadline: operation.deadline,
      seenAt: operation.seenAt,
      online: now - Date.parse(operation.seenAt) < 60_000,
      phase: operation.phase,
      question: current ? questions[current.question].title : null,
      contracts: settings.contracts,
      language: settings.language,
      score: operation.score,
      submission: submission
        ? {
            question: questions[submission.question].title,
            verdict: submission.result.verdict,
            language: submission.language,
            submittedAt: submission.submittedAt,
            ...(detail && { source: submission.source }),
          }
        : null,
      flags,
      awayMs: awayMs(events),
      ...(detail && { events, live: live && { ...live, question: questions[live.question].title } }),
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
