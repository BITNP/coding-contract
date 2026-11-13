import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cases } from '../server/question.js'
import { languages } from '../shared/languages.js'

const base = process.env.DEPLOYMENT_URL
const deployment = { skip: !base, timeout: 180_000 }

async function request(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  const result = await response.json()
  assert.equal(response.status, 200, JSON.stringify(result))
  return result
}

test('后端只提供 API，不托管网页或静态资源', deployment, async () => {
  assert.equal((await fetch(base)).status, 404)
  assert.equal((await fetch(`${base}/app.js`)).status, 404)
  assert.equal((await fetch(`${base}/api/session`)).status, 200)
})

test('独立前端的跨域预检与凭据请求', deployment, async () => {
  const origin = process.env.DEPLOYMENT_ORIGIN || 'http://127.0.0.1:5173'
  const response = await fetch(`${base}/api/operations`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  })
  assert.equal(response.status, 204)
  assert.equal(response.headers.get('access-control-allow-origin'), origin)
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true')
  const session = await fetch(`${base}/api/session`, { headers: { Origin: origin } })
  assert.equal(session.status, 200)
  assert.equal(session.headers.get('access-control-allow-origin'), origin)
  const denied = await fetch(`${base}/api/session`, { headers: { Origin: 'https://unlisted.invalid' } })
  assert.equal(denied.status, 403)
  assert.equal(denied.headers.get('access-control-allow-origin'), null)
})

for (const { id, name } of languages) {
  test(`${name} API 创建、校验、样例、提交与记录保存`, deployment, async () => {
    const operation = await request('/api/operations', { language: id, indicators: ['source-1'] })
    assert.equal(operation.language, id)
    const body = { language: id, source: operation.question.templates[id] }
    const path = `/api/operations/${operation.id}`
    const validation = await request(`${path}/validate`, body)
    assert.equal(validation.verdict, 'CHECKED', JSON.stringify(validation))
    const sample = await request(`${path}/sample`, body)
    assert.equal(sample.verdict, 'AC', JSON.stringify(sample))
    assert.equal(sample.cases.length, 1)
    const result = await request(`${path}/submit`, body)
    assert.equal(result.verdict, 'AC', JSON.stringify(result))
    assert.equal(result.passed, true)
    assert.equal(result.score, 1)
    assert.equal(result.cases.length, cases.length)
    assert.ok(
      result.cases.every((item) => item.verdict === 'AC'),
      JSON.stringify(result.cases),
    )
    const saved = await request(path)
    assert.equal(saved.submission.language, id)
    assert.equal(saved.submission.source, body.source)
    assert.equal(saved.submission.result.verdict, 'AC')
    assert.ok((await request('/api/records/best')).score >= 1)
  })
}
