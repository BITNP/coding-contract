import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const name = 'pioneer-judge'
const script = readFileSync(new URL('../server/provision.sh', import.meta.url), 'utf8')
const provision = `.provision = ${JSON.stringify([{ mode: 'system', script }])}`
const lima = (args, options = {}) => execFileSync('limactl', args, { stdio: 'inherit', ...options })

try {
  const instances = lima(['list', '--json'], { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
  const instance = instances.find((item) => item.name === name)
  if (!instance) {
    lima([
      'start',
      '--name',
      name,
      '--tty=false',
      '--set',
      provision,
      fileURLToPath(new URL('./lima.yaml', import.meta.url)),
    ])
  } else {
    const GiB = 1024 ** 3
    const changed =
      instance.config.provision?.[0]?.script !== script ||
      instance.cpus < 4 ||
      instance.memory < 4 * GiB ||
      instance.disk < 20 * GiB
    if (changed) {
      if (instance.status === 'Running') lima(['stop', name, '--tty=false'])
      lima([
        'edit',
        name,
        '--tty=false',
        '--set',
        provision,
        '--cpus',
        String(Math.max(4, instance.cpus)),
        '--memory',
        String(Math.max(4, instance.memory / GiB)),
        '--disk',
        String(Math.max(20, instance.disk / GiB)),
      ])
    }
    if (changed || instance.status !== 'Running') lima(['start', name, '--tty=false'])
  }

  await import('../server/self-test.js')
} catch (error) {
  console.error(
    error.code === 'ENOENT'
      ? '请先安装 Lima：brew install lima'
      : error.status
        ? '评测环境安装失败，原因见上方日志；修复后可重新运行 pnpm judge:install。'
        : error.message,
  )
  process.exitCode = 1
}
