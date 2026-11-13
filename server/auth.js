import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import * as oidc from 'openid-client'

const sessionAge = 24 * 60 * 60 * 1000
const loginAge = 10 * 60 * 1000
const sessionCookie = 'pioneer_session'
const loginCookie = 'pioneer_oidc'

export function authConfig(env = process.env) {
  const values = [env.OIDC_ISSUER, env.OIDC_CLIENT_ID, env.OIDC_CLIENT_SECRET, env.OIDC_REDIRECT_URL]
  if (!values.some(Boolean)) {
    if (env.AUTH_API_URL) throw new Error('AUTH_API_URL 已停用，请配置 OIDC_* 统一认证参数')
    return null
  }
  if (!values.every(Boolean))
    throw new Error('OIDC_ISSUER、OIDC_CLIENT_ID、OIDC_CLIENT_SECRET、OIDC_REDIRECT_URL 必须全部配置')
  const issuer = new URL(env.OIDC_ISSUER)
  const redirect = new URL(env.OIDC_REDIRECT_URL)
  const publicUrl = new URL(env.APP_PUBLIC_URL || redirect.origin)
  for (const url of [issuer, redirect, publicUrl]) {
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search)
      throw new Error('OIDC 和站点地址必须使用 HTTPS，且不能包含凭据、查询参数或片段')
  }
  const sameSite = env.COOKIE_SAME_SITE || 'lax'
  if (!['lax', 'none'].includes(sameSite)) throw new Error('OIDC 登录 Cookie 的 SameSite 必须为 lax 或 none')
  return {
    issuer: issuer.href,
    clientId: env.OIDC_CLIENT_ID,
    clientSecret: env.OIDC_CLIENT_SECRET,
    redirectUrl: redirect.href,
    publicUrl: publicUrl.href,
    sameSite,
  }
}

export function createAuth(config, { discover = oidc.discovery, now = Date.now } = {}) {
  const router = Router()
  const sessions = new Map()
  const pending = new Map()
  const available = Boolean(config)
  const cookieOptions = { httpOnly: true, secure: available, sameSite: config?.sameSite || 'lax', path: '/' }
  let configuration
  function provider() {
    configuration ||= discover(new URL(config.issuer), config.clientId, config.clientSecret, undefined, {
      timeout: 10,
    })
      .then((value) => {
        oidc.enableNonRepudiationChecks(value)
        return value
      })
      .catch((error) => {
        configuration = undefined
        throw error
      })
    return configuration
  }
  function cookie(req, name) {
    return req.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1)
  }
  function prune() {
    for (const map of [pending, sessions])
      for (const [id, item] of map) if (item.expiresAt <= now()) map.delete(id)
  }
  function authenticate(req, _res, next) {
    prune()
    req.sid = cookie(req, sessionCookie)
    req.user = sessions.get(req.sid)?.user || null
    next()
  }
  function requireUser(req, res, next) {
    if (available && !req.user) return res.status(401).json({ message: '请先统一登录后开始作战' })
    next()
  }
  function returnUrl(value) {
    const fallback = new URL(config.publicUrl)
    if (typeof value !== 'string' || !value.startsWith('/')) return fallback.href
    const target = new URL(value, fallback)
    return target.origin === fallback.origin ? target.href : fallback.href
  }
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  router.get('/login', async (req, res) => {
    if (!available) return res.status(503).json({ message: '统一认证尚未配置' })
    const server = await provider()
    const verifier = oidc.randomPKCECodeVerifier()
    const state = oidc.randomState()
    const nonce = oidc.randomNonce()
    const url = oidc.buildAuthorizationUrl(server, {
      redirect_uri: config.redirectUrl,
      scope: 'openid profile email',
      state,
      nonce,
      code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
      code_challenge_method: 'S256',
    })
    const id = randomUUID()
    pending.delete(cookie(req, loginCookie))
    pending.set(id, {
      verifier,
      state,
      nonce,
      returnTo: returnUrl(req.query.returnTo),
      expiresAt: now() + loginAge,
    })
    res.cookie(loginCookie, id, { ...cookieOptions, maxAge: loginAge })
    res.redirect(url.href)
  })
  router.get('/callback', async (req, res) => {
    if (!available) return res.status(503).json({ message: '统一认证尚未配置' })
    const id = cookie(req, loginCookie)
    const login = pending.get(id)
    pending.delete(id)
    res.clearCookie(loginCookie, cookieOptions)
    try {
      if (!login || login.expiresAt <= now()) throw new Error('Expired login')
      // Use the registered callback, never untrusted Host/X-Forwarded-* headers.
      const url = new URL(config.redirectUrl)
      url.search = new URL(req.originalUrl, config.redirectUrl).search
      const tokens = await oidc.authorizationCodeGrant(await provider(), url, {
        pkceCodeVerifier: login.verifier,
        expectedState: login.state,
        expectedNonce: login.nonce,
        idTokenExpected: true,
      })
      const claims = tokens.claims()
      if (!claims?.sub) throw new Error('Missing subject')
      const user = { id: claims.sub, name: claims.name || claims.preferred_username || claims.sub }
      sessions.delete(req.sid)
      const sid = randomUUID()
      sessions.set(sid, { user, expiresAt: now() + sessionAge })
      res.cookie(sessionCookie, sid, { ...cookieOptions, maxAge: sessionAge })
      res.redirect(login.returnTo)
    } catch {
      const url = new URL(config.publicUrl)
      url.searchParams.set('auth_error', '统一登录失败或已过期，请重试')
      res.redirect(url.href)
    }
  })
  router.post('/logout', (req, res) => {
    sessions.delete(req.sid)
    res.clearCookie(sessionCookie, cookieOptions).json({ ok: true })
  })
  return { router, authenticate, requireUser, available }
}
