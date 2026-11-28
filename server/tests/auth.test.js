import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { test } from 'node:test'
import express from 'express'
import * as oidc from 'openid-client'
import { authConfig, createAuth, mayAdmin } from '../auth.js'
import { createAdminRouter } from '../admin.js'
import { createRefereeRouter } from '../referee.js'
import { listen, startApi } from './http.js'

const config = {
  issuer: 'https://issuer.test',
  clientId: 'coding-contract',
  clientSecret: 'test-only-secret',
  redirectUrl: 'https://oj.test/api/auth/callback',
  publicUrl: 'https://oj.test/',
  sameSite: 'lax',
}
const oidcEnv = {
  OIDC_ISSUER: config.issuer,
  OIDC_CLIENT_ID: config.clientId,
  OIDC_CLIENT_SECRET: config.clientSecret,
  OIDC_REDIRECT_URL: config.redirectUrl,
}
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 })
const otherKeys = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...keys.publicKey.export({ format: 'jwk' }), kid: 'test', alg: 'RS256', use: 'sig' }

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
const adminClaims = { resource_access: { 'coding-contract': { roles: ['admin'] } } }

async function fixture(t) {
  const codes = new Map()
  const refreshTokens = new Map()
  let exchanges = 0
  let refreshes = 0
  let refreshOptions = {}
  let clock = Date.now()
  const issuer = express()
  issuer.use(express.urlencoded({ extended: false }))
  issuer.get('/jwks', (_req, res) => res.json({ keys: [jwk] }))
  issuer.post('/token', async (req, res) => {
    const refreshing = req.body.grant_type === 'refresh_token'
    let flow
    if (refreshing) {
      refreshes++
      flow = refreshTokens.get(req.body.refresh_token)
      refreshTokens.delete(req.body.refresh_token)
      await refreshOptions.wait?.()
      if (refreshOptions.error) return res.status(400).json({ error: 'invalid_grant' })
    } else {
      exchanges++
      flow = codes.get(req.body.code)
      codes.delete(req.body.code)
    }
    if (
      !flow ||
      req.body.client_id !== config.clientId ||
      req.body.client_secret !== config.clientSecret ||
      (!refreshing &&
        (req.body.redirect_uri !== config.redirectUrl ||
          req.body.grant_type !== 'authorization_code' ||
          createHash('sha256')
            .update(req.body.code_verifier || '')
            .digest('base64url') !== flow.challenge))
    )
      return res.status(400).json({ error: 'invalid_grant' })
    const issued = Math.floor(Date.now() / 1000)
    const refreshToken = `refresh-${Math.random()}`
    if (!flow.noRefresh) refreshTokens.set(refreshToken, flow)
    res.json({
      token_type: 'Bearer',
      access_token: 'test-access-token',
      expires_in: 300,
      ...(!flow.noRefresh && { refresh_token: refreshToken }),
      id_token:
        refreshing && refreshOptions.omitIdToken
          ? undefined
          : signedToken(
              {
                iss: config.issuer,
                aud: config.clientId,
                sub: 'alice',
                name: 'Alice',
                iat: issued,
                exp: Math.floor(clock / 1000) + 300,
                nonce: flow.nonce,
                ...flow.claims,
                ...(refreshing && refreshOptions.claims),
              },
              refreshing ? refreshOptions.key || flow.key : flow.key,
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
  const db = { prepare: () => ({ all: () => [] }) }
  app.use('/api/admin', createAdminRouter({ db, auth }))
  app.use(
    '/api/referee',
    createRefereeRouter({
      auth,
      db: { prepare: () => ({ all: () => [], get: () => undefined, run: () => ({ changes: 0 }) }) },
    }),
  )
  app.get('/api/session', (req, res) =>
    res.json({
      user: req.user,
      authAvailable: auth.available,
      admin: mayAdmin(auth, req.user),
    }),
  )
  app.get('/private', auth.requireUser, (req, res) => res.json({ owner: req.user.id }))
  const base = await listen(t, app)
  async function begin({ returnTo = '/', subject = 'alice', claims = {}, key, noRefresh = false } = {}) {
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
      noRefresh,
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
    refreshes: () => refreshes,
    setRefresh: (options) => {
      refreshOptions = options
    },
  }
}

test('访客模式需要显式开启，生产环境和部分 OIDC 配置要求完整认证', () => {
  assert.throws(() => authConfig({}), /必须全部配置/)
  assert.equal(authConfig({ ALLOW_GUEST: '1' }), null)
  assert.throws(() => authConfig({ NODE_ENV: 'production', ALLOW_GUEST: '1' }), /必须全部配置/)
  assert.throws(() => authConfig({ ALLOW_GUEST: '1', OIDC_ISSUER: config.issuer }), /必须全部配置/)
  assert.equal(authConfig(oidcEnv).publicUrl, config.publicUrl)
  assert.equal(authConfig({ ...oidcEnv, ALLOW_GUEST: '1' }).clientId, config.clientId)
  assert.throws(() => authConfig({ ...oidcEnv, OIDC_REDIRECT_URL: 'http://oj.test/callback' }), /HTTPS/)
  assert.throws(() => authConfig({ ...oidcEnv, COOKIE_SAME_SITE: 'strict' }), /SameSite/)
})

test('管理台只接受本客户端的 admin 角色，身份和其他角色不能代替授权', async (t) => {
  const f = await fixture(t)
  const url = `${f.base}/api/admin/operations`
  assert.equal((await fetch(url)).status, 401)
  for (const [claims, expected] of [
    [adminClaims, 200],
    [{}, 403],
    [{ realm_access: { roles: ['admin', 'permission-techsvc-admin'] } }, 403],
    [{ resource_access: { 'other-client': { roles: ['admin'] } } }, 403],
    [{ resource_access: { 'coding-contract': { roles: 'admin' } } }, 403],
  ]) {
    const response = await f.callback(await f.begin({ claims: { name: 'alice', ...claims } }))
    const session = cookie(response, 'pioneer_session')
    assert.equal((await fetch(url, { headers: { cookie: session } })).status, expected)
  }
})

test('裁判台与管理台共用 admin 角色授权', async (t) => {
  const f = await fixture(t)
  const url = `${f.base}/api/referee/operations`
  assert.equal((await fetch(url)).status, 401)
  for (const [claims, expected] of [
    [adminClaims, 200],
    [{}, 403],
    [{ resource_access: { 'other-client': { roles: ['admin'] } } }, 403],
  ]) {
    const response = await f.callback(
      await f.begin({ subject: 'alice', claims: { name: 'alice', ...claims } }),
    )
    const session = cookie(response, 'pioneer_session')
    const listed = await fetch(url, { headers: { cookie: session } })
    assert.equal(listed.status, expected)
    if (expected === 200) assert.deepEqual((await listed.json()).operations, [])
    const meta = await (
      await fetch(`${f.base}/api/session`, { headers: { cookie: session } })
    ).json()
    assert.equal(meta.admin, expected === 200)
  }
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
    { id: 'alice', name: 'Alice', avatar: null, isAdmin: false },
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
  f.advance(24 * 60 * 60 * 1000 - 1)
  assert.equal(
    (await fetch(`${f.base}/private`, { headers: { cookie: cookie(bob, 'pioneer_session') } })).status,
    200,
  )
  f.advance(1)
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

test('刷新后重新计算管理员权限，轮换 refresh token，并合并并发刷新', async (t) => {
  const f = await fixture(t)
  const session = cookie(await f.callback(await f.begin({ claims: adminClaims })), 'pioneer_session')
  const headers = { cookie: session }
  const url = `${f.base}/api/admin/operations`
  assert.equal((await fetch(url, { headers })).status, 200)
  f.setRefresh({ claims: { resource_access: {} } })
  f.advance(5 * 60 * 1000)
  const responses = await Promise.all(Array.from({ length: 5 }, () => fetch(url, { headers })))
  assert.deepEqual(
    responses.map((r) => r.status),
    [403, 403, 403, 403, 403],
  )
  assert.equal(f.refreshes(), 1)
  const current = await (await fetch(`${f.base}/api/session`, { headers })).json()
  assert.equal(current.user.isAdmin, false)
  assert.equal(JSON.stringify(current).includes('refresh-'), false)
  f.setRefresh({ claims: adminClaims })
  f.advance(5 * 60 * 1000)
  assert.equal((await fetch(url, { headers })).status, 200)
  assert.equal(f.refreshes(), 2)
})

test('刷新失败、缺少 ID Token、身份变化和无效签名均撤销会话', async (t) => {
  const f = await fixture(t)
  for (const options of [
    { error: true },
    { omitIdToken: true },
    { claims: { sub: 'bob' } },
    { claims: { aud: 'other-client' } },
    { claims: { iss: 'https://attacker.test' } },
    { claims: { exp: 1 } },
    { key: otherKeys.privateKey },
  ]) {
    const session = cookie(await f.callback(await f.begin({ claims: adminClaims })), 'pioneer_session')
    f.setRefresh(options)
    f.advance(5 * 60 * 1000)
    const response = await fetch(`${f.base}/api/admin/operations`, { headers: { cookie: session } })
    assert.equal(response.status, 401)
    assert.match(cookie(response, 'pioneer_session'), /^pioneer_session=$/)
    assert.equal((await fetch(`${f.base}/private`, { headers: { cookie: session } })).status, 401)
  }
})

test('没有 refresh token 的会话到期后必须重新登录', async (t) => {
  const f = await fixture(t)
  const session = cookie(
    await f.callback(await f.begin({ noRefresh: true, claims: adminClaims })),
    'pioneer_session',
  )
  const headers = { cookie: session }
  assert.equal((await fetch(`${f.base}/api/admin/operations`, { headers })).status, 200)
  f.advance(5 * 60 * 1000)
  assert.equal((await fetch(`${f.base}/api/admin/operations`, { headers })).status, 401)
})

test('刷新进行时退出，不恢复已注销的会话', async (t) => {
  const f = await fixture(t)
  const session = cookie(await f.callback(await f.begin({ claims: adminClaims })), 'pioneer_session')
  const headers = { cookie: session }
  let release
  let started
  const waiting = new Promise((resolve) => {
    started = resolve
  })
  f.setRefresh({
    wait: () => {
      started()
      return new Promise((resolve) => {
        release = resolve
      })
    },
  })
  f.advance(5 * 60 * 1000)
  const pending = fetch(`${f.base}/api/admin/operations`, { headers })
  await waiting
  try {
    assert.equal((await fetch(`${f.base}/api/auth/logout`, { method: 'POST', headers })).status, 200)
  } finally {
    release()
  }
  assert.equal((await pending).status, 401)
  assert.equal((await fetch(`${f.base}/private`, { headers })).status, 401)
})

test('实际 API 启用 OIDC 后，未登录无法创建、读取作战记录或评测代码', async (t) => {
  const { base } = await startApi(t, oidcEnv)
  assert.deepEqual(await (await fetch(`${base}/api/session`)).json(), {
    user: null,
    authAvailable: true,
    admin: false,
  })
  for (const [path, method] of [
    ['/api/records/best', 'GET'],
    ['/api/operations', 'POST'],
    ['/api/operations/known-id', 'GET'],
    ['/api/operations/known-id/sample', 'POST'],
    ['/api/operations/known-id/submit', 'POST'],
  ]) {
    assert.equal((await fetch(base + path, { method })).status, 401, path)
  }
})
