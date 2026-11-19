import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export function openDatabase(
  path = process.env.DATA_DIR || fileURLToPath(new URL('./data/', import.meta.url)),
) {
  mkdirSync(path, { recursive: true })
  const db = new DatabaseSync(`${path}/operations.sqlite`)
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS operations (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, data TEXT NOT NULL,
      created_at TEXT AS (data ->> '$.createdAt'),
      deadline TEXT AS (data ->> '$.deadline'),
      finished_at TEXT AS (data ->> '$.finishedAt'),
      score INTEGER AS (data ->> '$.total'),
      duration_ms INTEGER AS (round((julianday(finished_at) - julianday(created_at)) * 86400000))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS active_user ON operations(user_id) WHERE finished_at IS NULL;
    CREATE INDEX IF NOT EXISTS active_deadline ON operations(deadline) WHERE finished_at IS NULL;
    CREATE INDEX IF NOT EXISTS recent_operations ON operations(created_at);
    CREATE INDEX IF NOT EXISTS personal_scores ON operations(user_id, score DESC, duration_ms, finished_at, id)
      WHERE finished_at IS NOT NULL;
  `)
  return db
}

export function transaction(db, work) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = work()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
