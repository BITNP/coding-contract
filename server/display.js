import { Router } from 'express'
import { languageById } from '../shared/languages.js'
import { questions } from './questions/index.js'

export function displayRecords(db) {
  const records = db.prepare(`
    SELECT data, duration_ms
    FROM operations
    WHERE finished_at IS NOT NULL AND score > 0
    ORDER BY finished_at, id
  `)

  return records.all().flatMap(({ data, duration_ms }) => {
      const operation = JSON.parse(data)
      const submission = operation.submission
      const question = submission && questions[submission.question]
      const language = submission && languageById[submission.language]
      if (!question || !language || !Number.isFinite(operation.score)) return []
      const reviewedAt = operation.review?.at ?? null
      return [
        {
          id: operation.id,
          eventId: `${operation.id}:${operation.score}:${reviewedAt ?? operation.finishedAt}`,
          userId: operation.user.id,
          name: operation.user.name,
          avatar: operation.user.avatar ?? null,
          score: operation.score,
          durationMs: duration_ms,
          question: { id: question.id, title: question.title },
          language: { id: language.id, name: language.name },
          contracts: operation.contracts,
          submittedAt: submission.submittedAt ?? operation.finishedAt,
          finishedAt: operation.finishedAt,
          reviewedAt,
        },
      ]
    })
}

export function displayBoard(db) {
  return Router().get('/', (_req, res) => {
    res.set('Cache-Control', 'no-store').json({ serverTime: Date.now(), records: displayRecords(db) })
  })
}
