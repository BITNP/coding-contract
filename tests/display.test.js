import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { openDatabase } from '../server/database.js'
import { displayRecords } from '../server/display.js'
import { createOperation, finishOperation } from '../server/operations.js'

test('大屏数据只公开可展示的成绩字段，并覆盖不同题目和语言', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'pioneer-display-'))
  const db = openDatabase(dir)
  t.after(async () => {
    db.close()
    await rm(dir, { recursive: true, force: true })
  })

  const insert = db.prepare('INSERT INTO operations (id, user_id, data) VALUES (?, ?, ?)')
  const now = Date.now() - 120_000
  const records = [
    {
      id: 'display-cpp',
      user: { id: 'alice', name: 'Alice', avatar: null },
      language: 'cpp',
      question: 'max-rise',
      indicators: ['source-2'],
    },
    {
      id: 'display-python',
      user: { id: 'bob', name: 'Bob', avatar: 'https://example.test/bob.webp' },
      language: 'python',
      question: 'maze',
      indicators: ['source-1'],
    },
  ]
  for (const [index, item] of records.entries()) {
    const operation = createOperation({
      id: item.id,
      language: item.language,
      indicators: item.indicators,
      user: item.user,
      now: now + index * 1000,
    })
    operation.submission = {
      question: item.question,
      language: item.language,
      source: 'secret source',
      contracts: item.indicators,
      submittedAt: new Date(now + index * 1000 + 30_000).toISOString(),
      result: { verdict: 'AC', passed: true },
    }
    finishOperation(operation, 'passed', new Date(now + index * 1000 + 30_000).toISOString())
    insert.run(operation.id, item.user.id, JSON.stringify(operation))
  }

  const abandoned = createOperation({
    id: 'display-abandoned',
    language: 'cpp',
    indicators: ['source-1'],
    user: { id: 'carol', name: 'Carol', avatar: null },
    now,
  })
  finishOperation(abandoned, 'abandoned', new Date(now + 10_000).toISOString())
  insert.run(abandoned.id, 'carol', JSON.stringify(abandoned))

  const items = displayRecords(db)
  assert.equal(items.length, 2)
  assert.deepEqual(
    items.map(({ id, question, language }) => [id, question.id, language.id]),
    [
      ['display-cpp', 'max-rise', 'cpp'],
      ['display-python', 'maze', 'python'],
    ],
  )
  assert.ok(items.every((item) => item.eventId && item.userId && item.name))
  assert.equal(JSON.stringify(items).includes('secret source'), false)
  assert.equal(JSON.stringify(items).includes('display-abandoned'), false)
})
