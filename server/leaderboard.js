import { Router } from 'express'
import { languageById } from '../shared/languages.js'
import { questions } from './questions/index.js'

const rankingOrder = 'score DESC, duration_ms, finished_at, id'

export function leaderboard(db) {
  const top = db.prepare(`
    WITH ranked AS (
      SELECT id, score, duration_ms, finished_at,
        row_number() OVER (PARTITION BY user_id ORDER BY ${rankingOrder}) AS personal_rank
      FROM operations WHERE finished_at IS NOT NULL AND score > 0
    ), leaders AS (
      SELECT id FROM ranked WHERE personal_rank = 1 ORDER BY ${rankingOrder} LIMIT 50
    )
    SELECT data, duration_ms FROM leaders JOIN operations USING (id) ORDER BY ${rankingOrder}
  `)
  return Router().get('/', (_req, res) =>
    res.json(
      top.all().map(({ data, duration_ms }, index) => {
        const operation = JSON.parse(data)
        const { name, avatar } = operation.user
        return {
          id: operation.id,
          rank: index + 1,
          name,
          avatar,
          score: operation.score,
          language: languageById[operation.language].name,
          durationMs: duration_ms,
          question: questions[operation.submission.question].title,
          contracts: operation.contracts,
        }
      }),
    ),
  )
}
