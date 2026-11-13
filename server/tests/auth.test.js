import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import express from 'express'
import * as oidc from 'openid-client'
import { authConfig, createAuth } from '../auth.js'

const config = {
  issuer: 'https://issuer.test',
  clientId: 'coding-contract',
  clientSecret: 'test-only-secret',
  redirectUrl: 'https://oj.test/api/auth/callback',
  publicUrl: 'https://oj.test/',
  sameSite: 'lax',
}
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 })
const otherKeys = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...keys.publicKey.export({ format: 'jwk' }), kid: 'test', alg: 'RS256', use: 'sig' }

async function listen(t, app) {
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve) => server.close(resolve)))
  return `http://127.0.0.1:${server.address().port}`
}
function signedToken(claims, key = keys.privateKey) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url')
  const payload = `${header}.${body}`
  return `${payload}.${sign('RSA-SHA256', Buffer.from(payload), key).toString('base64url')}`
}
const cookie = (response, name) =>
  response.headers
    .getSetCookie()
    .find((value) => value.startsWith(`${name}=`))
    ?.split(';')[0]

async function fixture(t) {
  const codes = new Map()
  let exchanges = 0
  let clock = Date.now()
  const issuer = express()
  issuer.use(express.urlencoded({ extended: false }))
  issuer.get('/jwks', (_req, res) => res.json({ keys: [jwk] }))
  issuer.post('/token', (req, res) => {
    exchanges++
    const flow = codes.get(req.body.code)
    codes.delete(req.body.code)
    if (
      !flow ||
      req.body.client_id !== config.clientId ||
      req.body.client_secret !== config.clientSecret ||
      req.body.redirect_uri !== config.redirectUrl ||
      req.body.grant_type !== 'authorization_code' ||
      createHash('sha256')
        .update(req.body.code_verifier || '')
        .digest('base64url') !== flow.challenge
    )
      return res.status(400).json({ error: 'invalid_grant' })
    const issued = Math.floor(Date.now() / 1000)
    res.json({
      token_type: 'Bearer',
      access_token: 'test-access-token',
      expires_in: 300,
      id_token: signedToken(
        {
          iss: config.issuer,
          aud: config.clientId,
          sub: 'alice',
          name: 'Alice',
          iat: issued,
          exp: issued + 300,
          nonce: flow.nonce,
          ...flow.claims,
        },
        flow.key,
      ),
    })
  })
  const issuerBase = await listen(t, issuer)
  const provider = new oidc.Configuration(
    {
      issuer: config.issuer,
      authorization_endpoint: `${config.issuer}/authorize`,
      token_endpoint: `${config.issuer}/token`,
      jwks_uri: `${config.issuer}/jwks`,
      response_types_supported: ['code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
    },
    config.clientId,
    config.clientSecret,
  )
  // Keep HTTPS metadata and real protocol/signature checks; route only this mock issuer to a local HTTP server.
  provider[oidc.customFetch] = (input, init) => {
    const url = new URL(input)
    assert.equal(url.origin, config.issuer)
    return fetch(`${issuerBase}${url.pathname}${url.search}`, init)
  }
  const auth = createAuth(config, { discover: async () => provider, now: () => clock })
  const app = express()
  app.use(auth.authenticate)
  app.use('/api/auth', auth.router)
  app.get('/api/session', (req, res) => res.json({ user: req.user, authAvailable: auth.available }))
  app.get('/private', auth.requireUser, (req, res) => res.json({ owner: req.user.id }))
  const base = await listen(t, app)
  async function begin({ returnTo = '/', subject = 'alice', claims = {}, key } = {}) {
    const response = await fetch(`${base}/api/auth/login?${new URLSearchParams({ returnTo })}`, {
      redirect: 'manual',
    })
    assert.equal(response.status, 302)
    const url = new URL(response.headers.get('location'))
    assert.equal(url.origin, config.issuer)
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
    assert.equal(url.searchParams.get('redirect_uri'), config.redirectUrl)
    assert.equal(url.searchParams.get('response_type'), 'code')
    const code = `code-${codes.size}-${Math.random()}`
    codes.set(code, {
      challenge: url.searchParams.get('code_challenge'),
      nonce: url.searchParams.get('nonce'),
      claims: { sub: subject, ...claims },
      key,
    })
    return { cookie: cookie(response, 'pioneer_oidc'), state: url.searchParams.get('state'), code, response }
  }
  function callback(flow, changes = {}, headers = {}) {
    const query = new URLSearchParams({ code: flow.code, state: flow.state, ...changes })
    return fetch(`${base}/api/auth/callback?${query}`, {
      redirect: 'manual',
      headers: { cookie: flow.cookie || '', ...headers },
    })
  }
  return {
    base,
    begin,
    callback,
    advance: (ms) => {
      clock += ms
    },
    exchanges: () => exchanges,
  }
}

test('OIDC 配置缺项、旧登录配置和不安全地址不会静默退回访客模式', () => {
  assert.equal(authConfig({}), null)
  assert.throws(() => authConfig({ OIDC_ISSUER: config.issuer }), /必须全部配置/)
  assert.throws(() => authConfig({ AUTH_API_URL: 'https://old.test' }), /已停用/)
  const env = {
    OIDC_ISSUER: config.issuer,
    OIDC_CLIENT_ID: config.clientId,
    OIDC_CLIENT_SECRET: config.clientSecret,
    OIDC_REDIRECT_URL: config.redirectUrl,
  }
  assert.equal(authConfig(env).publicUrl, config.publicUrl)
  assert.throws(() => authConfig({ ...env, OIDC_REDIRECT_URL: 'http://oj.test/callback' }), /HTTPS/)
  assert.throws(() => authConfig({ ...env, COOKIE_SAME_SITE: 'strict' }), /SameSite/)
})

test('真实授权码交换、PKCE、签名校验、个人身份、退出及会话过期', async (t) => {
  const f = await fixture(t)
  assert.equal((await fetch(`${f.base}/private`)).status, 401)
  const flow = await f.begin({ returnTo: '/operation/123?tab=code' })
  const binding = flow.response.headers.getSetCookie()[0]
  assert.match(binding, /HttpOnly/)
  assert.match(binding, /Secure/)
  assert.match(binding, /SameSite=Lax/)
  const response = await f.callback(flow, {}, { Host: 'attacker.test', 'X-Forwarded-Host': 'attacker.test' })
  assert.equal(response.headers.get('location'), 'https://oj.test/operation/123?tab=code')
  const session = cookie(response, 'pioneer_session')
  assert.ok(session)
  assert.match(
    response.headers.getSetCookie().find((v) => v.startsWith('pioneer_session=')),
    /Secure/,
  )
  assert.deepEqual(
    (await (await fetch(`${f.base}/api/session`, { headers: { cookie: session } })).json()).user,
    { id: 'alice', name: 'Alice' },
  )
  assert.deepEqual(await (await fetch(`${f.base}/private`, { headers: { cookie: session } })).json(), {
    owner: 'alice',
  })
  const bob = await f.callback(await f.begin({ subject: 'bob' }))
  assert.deepEqual(
    await (await fetch(`${f.base}/private`, { headers: { cookie: cookie(bob, 'pioneer_session') } })).json(),
    { owner: 'bob' },
  )
  assert.equal(
    (await fetch(`${f.base}/api/auth/logout`, { method: 'POST', headers: { cookie: session } })).status,
    200,
  )
  assert.equal((await fetch(`${f.base}/private`, { headers: { cookie: session } })).status, 401)
  f.advance(24 * 60 * 60 * 1000 + 1)
  assert.equal(
    (await fetch(`${f.base}/private`, { headers: { cookie: cookie(bob, 'pioneer_session') } })).status,
    401,
  )
})

test('缺少浏览器绑定、state 错误、过期和回调重放不能建立会话', async (t) => {
  const f = await fixture(t)
  const flow = await f.begin()
  let response = await f.callback({ ...flow, cookie: undefined })
  assert.match(response.headers.get('location'), /auth_error=/)
  assert.equal(f.exchanges(), 0)
  response = await f.callback(flow, { state: 'wrong' })
  assert.equal(cookie(response, 'pioneer_session'), undefined)
  assert.equal(f.exchanges(), 0)
  response = await f.callback(flow)
  assert.equal(cookie(response, 'pioneer_session'), undefined)
  const expired = await f.begin()
  f.advance(10 * 60 * 1000 + 1)
  assert.equal(cookie(await f.callback(expired), 'pioneer_session'), undefined)
  const fresh = await f.begin()
  assert.ok(cookie(await f.callback(fresh), 'pioneer_session'))
  assert.equal(cookie(await f.callback(fresh), 'pioneer_session'), undefined)
})

test('错误 nonce、issuer、audience、过期令牌及伪造签名均被拒绝', async (t) => {
  const f = await fixture(t)
  for (const options of [
    { claims: { nonce: 'wrong' } },
    { claims: { iss: 'https://attacker.test' } },
    { claims: { aud: 'other-client' } },
    { claims: { exp: 1 } },
    { key: otherKeys.privateKey },
  ]) {
    const response = await f.callback(await f.begin(options))
    assert.equal(cookie(response, 'pioneer_session'), undefined)
    assert.match(response.headers.get('location'), /auth_error=/)
  }
})

test('登录返回地址不能跳到外部站点', async (t) => {
  const f = await fixture(t)
  for (const returnTo of ['https://attacker.test', '//attacker.test', '/\\attacker.test']) {
    const response = await f.callback(await f.begin({ returnTo }))
    assert.equal(response.headers.get('location'), config.publicUrl)
  }
})

test('实际 API 启用 OIDC 后，未登录无法创建、读取、校验或提交作战记录', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'pioneer-auth-test-'))
  const child = spawn(process.execPath, ['index.js'], {
    cwd: new URL('../', import.meta.url),
    env: {
      ...process.env,
      DATA_DIR: dir,
      HOST: '127.0.0.1',
      PORT: '0',
      OIDC_ISSUER: config.issuer,
      OIDC_CLIENT_ID: config.clientId,
      OIDC_CLIENT_SECRET: config.clientSecret,
      OIDC_REDIRECT_URL: config.redirectUrl,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  t.after(async () => {
    child.kill()
    if (child.exitCode === null) await once(child, 'exit')
    await rm(dir, { recursive: true, force: true })
  })
  let output = ''
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('API startup timed out: ' + output)), 10000)
    child.stdout.on('data', (chunk) => {
      output += chunk
      const match = /API: (http:\/\/127\.0\.0\.1:\d+)/.exec(output)
      if (match) {
        clearTimeout(timer)
        resolve(match[1])
      }
    })
    child.stderr.on('data', (chunk) => {
      output += chunk
    })
    child.once('exit', () => {
      clearTimeout(timer)
      reject(new Error(output))
    })
  })
  assert.deepEqual(await (await fetch(`${base}/api/session`)).json(), { user: null, authAvailable: true })
  for (const [path, method] of [
    ['/api/records/best', 'GET'],
    ['/api/operations', 'POST'],
    ['/api/operations/known-id', 'GET'],
    ['/api/operations/known-id/validate', 'POST'],
    ['/api/operations/known-id/sample', 'POST'],
    ['/api/operations/known-id/submit', 'POST'],
  ]) {
    assert.equal((await fetch(base + path, { method })).status, 401, path)
  }
})
