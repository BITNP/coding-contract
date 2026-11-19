import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

export async function listen(t, handler) {
  const server = createServer(handler).listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve)
        server.closeAllConnections()
      }),
  )
  return `http://127.0.0.1:${server.address().port}`
}

export async function startApi(t, env) {
  const dir = await mkdtemp(join(tmpdir(), 'pioneer-api-test-'))
  const child = spawn(process.execPath, ['index.js'], {
    cwd: new URL('../', import.meta.url),
    env: {
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT: '0',
      DATA_DIR: dir,
      OIDC_ISSUER: '',
      OIDC_CLIENT_ID: '',
      OIDC_CLIENT_SECRET: '',
      OIDC_REDIRECT_URL: '',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const exited = once(child, 'close')
  t.after(async () => {
    child.kill()
    try {
      await exited
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
  const lines = createInterface({ input: child.stdout, signal: AbortSignal.timeout(10_000) })
  for await (const line of lines) {
    if (line.startsWith('API: ')) return { base: line.slice(5), dir }
  }
  throw new Error('API 在启动前退出或超时')
}
