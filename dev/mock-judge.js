// 仅用于本地开发的 go-judge 替身：不执行代码，按题面样例直接返回期望输出。
// 启动：pnpm judge:mock（默认 127.0.0.1:5050，与 JUDGE_URL 默认值一致）
// 用法：在源码中加入 MOCK_WA / MOCK_CE / MOCK_TLE 可分别模拟答案错误、编译错误、超时。
import { createServer } from 'node:http'
import { questions } from '../server/questions/index.js'

const answers = new Map()
for (const question of Object.values(questions))
  for (const item of question.cases) answers.set(item.input, item.answer)

const port = Number(process.env.MOCK_JUDGE_PORT || 5050)
const host = process.env.MOCK_JUDGE_HOST || '127.0.0.1'
const compiledFlags = new Map()

function sourceOf(command) {
  return Object.values(command.copyIn || {})
    .map((file) => file?.content || '')
    .join('\n')
}

function markers(command) {
  const source = sourceOf(command)
  return {
    wa: source.includes('MOCK_WA'),
    ce: source.includes('MOCK_CE'),
    tle: source.includes('MOCK_TLE'),
  }
}

function result(status, { stdout = '', stderr = '', time = 1_200_000, memory = 262_144, fileIds } = {}) {
  return {
    status,
    exitStatus: status === 'Accepted' ? 0 : 1,
    time,
    memory,
    files: { stdout, stderr },
    ...(fileIds && { fileIds }),
  }
}

function run(command) {
  const args = command.args || []
  if (args.includes('analyze.py')) {
    const filename = args.at(-1)
    const source = command.copyIn?.[filename]?.content ?? ''
    const facts = {
      bytes: Buffer.byteLength(source),
      codeLines: source.split('\n').filter((line) => line.trim()).length,
      syntax: [],
      operators: [],
      names: [],
    }
    return result('Accepted', { stdout: JSON.stringify(facts) })
  }
  const flags = markers(command)
  if (command.copyOutCached?.length) {
    if (flags.ce)
      return result('Nonzero Exit Status', { stderr: '模拟编译错误：请删除源码中的 MOCK_CE' })
    const fileIds = Object.fromEntries(command.copyOutCached.map((name) => [name, `mock-${name}`]))
    for (const id of Object.values(fileIds)) compiledFlags.set(id, flags)
    return result('Accepted', { fileIds })
  }
  const fileId = Object.values(command.copyIn || {})
    .map((file) => file?.fileId)
    .find(Boolean)
  const runFlags = compiledFlags.get(fileId) || flags
  if (runFlags.tle) return result('Time Limit Exceeded')
  const input = command.files?.[0]?.content
  return result('Accepted', {
    stdout: runFlags.wa ? 'mock-wrong-answer' : answers.get(input) ?? 'mock-missing-answer',
  })
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

const server = createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  if (req.method === 'DELETE' && req.url?.startsWith('/file/')) {
    res.end('{}')
    return
  }
  if (req.method !== 'POST' || req.url !== '/run') {
    res.statusCode = 404
    res.end(JSON.stringify({ message: 'mock judge: 未找到接口' }))
    return
  }
  try {
    const { cmd } = await readBody(req)
    res.end(JSON.stringify(cmd.map(run)))
  } catch (error) {
    res.statusCode = 400
    res.end(JSON.stringify({ message: error.message }))
  }
})

server.listen(port, host, () =>
  console.log(`模拟评测服务: http://${host}:${port}（不执行代码，仅本地开发使用）`),
)
