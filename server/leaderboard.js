import { Router } from 'express'
import { languageById } from '../shared/languages.js'

export function leaderboard(db) {
  const top = db.prepare(`
    SELECT name, avatar, score, language, duration_ms AS durationMs, updated_at AS updatedAt FROM records
    WHERE score > 0 AND name <> '' ORDER BY score DESC, duration_ms, updated_at LIMIT 50
  `)
  return Router().get('/', (_req, res) =>
    res.json(
      top.all().map((row, index) => ({
        rank: index + 1,
        ...row,
        language: languageById[row.language]?.name || row.language,
      })),
    ),
  )
}
