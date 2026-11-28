import { Router } from 'express'
import { automaticPoints, pointsOf, requiresReferee } from '../shared/contracts.js'
import { questions } from './questions/index.js'
import { awayMs, flaggedCounts } from './activity.js'
import { mayAdmin } from './auth.js'
import { transaction } from './database.js'

const window24h = 24 * 60 * 60 * 1000
const guest = { id: 'preview', name: '访客', avatar: null }
const fail = (status, message) => Object.assign(new Error(message), { status })

export function createRefereeRouter({ db, auth }) {
  const recent = db.prepare(
    'SELECT data FROM operations WHERE created_at >= ? ORDER BY created_at DESC',
  )
  const byId = db.prepare('SELECT data FROM operations WHERE id = ?')
  const update = db.prepare('UPDATE operations SET data = ? WHERE id = ?')
  const router = Router()
  const me = (req) => req.user || guest

  router.use((req, res, next) => {
    if (!auth.available) return next()
    if (!req.user) return res.status(401).json({ message: '请先统一登录' })
    if (!mayAdmin(auth, req.user)) return res.status(403).json({ message: '无管理权限' })
    next()
  })

  function change(id, work) {
    return transaction(db, () => {
      const row = byId.get(id)
      if (!row) throw fail(404, '未找到这次作战')
      const operation = JSON.parse(row.data)
      const changed = work(operation)
      if (changed !== false) update.run(JSON.stringify(operation), id)
      return operation
    })
  }

  function summarize(operation, now, viewer, detail = false) {
    const { events = [], submission, live } = operation
    const current = submission?.question ?? live?.question
    const question = current && questions[current] ? questions[current].title : null
    return {
      id: operation.id,
      user: {
        id: operation.user.id,
        name: operation.user.name,
        avatar: operation.user.avatar ?? null,
      },
      createdAt: operation.createdAt,
      deadline: operation.deadline,
      seenAt: operation.seenAt,
      online: now - Date.parse(operation.seenAt) < 60_000,
      phase: operation.phase,
      language: operation.language,
      contracts: operation.contracts,
      points: pointsOf(operation.contracts),
      selectedScore: operation.selectedScore ?? 0,
      automaticScore: automaticPoints(operation.contracts),
      score: operation.score,
      pairCode: operation.pairCode,
      referee: operation.referee && { id: operation.referee.id, name: operation.referee.name },
      mine: operation.referee?.id === viewer,
      review: operation.review || null,
      question,
      submission: submission && {
        question: questions[submission.question]?.title ?? null,
        verdict: submission.result.verdict,
        language: submission.language,
        submittedAt: submission.submittedAt,
        ...(detail && { source: submission.source }),
      },
      flags: flaggedCounts(events),
      awayMs: awayMs(events),
      ...(detail && {
        events,
        live: live && { ...live, question: questions[live.question]?.title ?? null },
      }),
    }
  }

  router.get('/operations', (req, res) => {
    const now = Date.now()
    const viewer = me(req).id
    const operations = recent
      .all(new Date(now - window24h).toISOString())
      .map((row) => JSON.parse(row.data))
      .filter((operation) => requiresReferee(operation.contracts))
      .map((operation) => summarize(operation, now, viewer))
    res.json({ serverTime: now, operations })
  })

  router.get('/operations/:id', (req, res) => {
    const row = byId.get(req.params.id)
    if (!row) return res.status(404).json({ message: '未找到这次作战' })
    const operation = JSON.parse(row.data)
    if (!requiresReferee(operation.contracts))
      return res.status(404).json({ message: '这次作战无需线下核验' })
    res.json(summarize(operation, Date.now(), me(req).id, true))
  })

  // 参赛者出示配对码，裁判在裁判端接入；一名裁判可同时接入多名参赛者。
  router.post('/operations/:id/pair', (req, res) => {
    const referee = me(req)
    const operation = change(req.params.id, (current) => {
      if (!requiresReferee(current.contracts)) throw fail(400, '这次作战无需线下核验')
      if (current.finishedAt || current.phase !== 'active') throw fail(409, '作战已结束，无法配对')
      if (current.referee?.id === referee.id) throw fail(409, '已接入这次作战')
      if (current.referee) throw fail(409, '该选手已由其他裁判接入')
      current.referee = { id: referee.id, name: referee.name, at: new Date().toISOString() }
    })
    res.json(summarize(operation, Date.now(), referee.id, true))
  })

  // 只有接入该选手的裁判可以确认或驳回最终成绩。
  router.post('/operations/:id/review', (req, res) => {
    const { decision } = req.body || {}
    if (!['confirmed', 'rejected'].includes(decision)) throw fail(400, '核验结论无效')
    const referee = me(req)
    const operation = change(req.params.id, (current) => {
      if (current.referee?.id !== referee.id) throw fail(403, '只有配对的裁判可以核验成绩')
      if (!current.finishedAt || current.phase !== 'passed') throw fail(409, '作战尚未通过，暂不能核验')
      if (current.review?.status !== 'pending') throw fail(409, '这次成绩已核验')
      current.review = {
        status: decision,
        by: { id: referee.id, name: referee.name },
        at: new Date().toISOString(),
      }
      current.score = decision === 'confirmed' ? pointsOf(current.contracts) : 0
    })
    res.json(summarize(operation, Date.now(), referee.id, true))
  })

  return router
}
