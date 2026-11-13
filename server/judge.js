import { readFileSync } from 'node:fs'
import { contractById, selectionErrors } from '../shared/contracts.js'
import { checkContracts, memoryLimit } from '../shared/checks.js'
import { question, cases } from './question.js'
import { languageById } from '../shared/languages.js'
import { runtimes } from './runtimes.js'

const analyzer = readFileSync(new URL('./analyze.py', import.meta.url), 'utf8')
const MiB = 1024 * 1024
const statusCodes = {
  'Time Limit Exceeded': 'TLE',
  'Memory Limit Exceeded': 'MLE',
  'Output Limit Exceeded': 'OLE',
  'Nonzero Exit Status': 'RE',
  Signalled: 'RE',
}

const environment = ['PATH=/usr/bin:/bin', 'LANG=C.UTF-8', 'HOME=/w', 'TMPDIR=/tmp']

async function sandbox(cmd) {
  const response = await fetch(`${process.env.JUDGE_URL || 'http://127.0.0.1:5050'}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cmd: [
        {
          env: environment,
          cpuLimit: 5e9,
          clockLimit: 10e9,
          memoryLimit: 512 * MiB,
          procLimit: 64,
          files: [{ content: '' }, { name: 'stdout', max: MiB }, { name: 'stderr', max: MiB }],
          ...cmd,
        },
      ],
    }),
  })
  if (!response.ok) throw new Error(`评测服务响应 ${response.status}`)
  const [result] = await response.json()
  return result
}

export async function evaluate({ source, language, indicators, mode = 'submit' }) {
  const errors = selectionErrors(indicators, language)
  if (errors.length) throw Object.assign(new Error(errors.join('；')), { status: 400 })
  if (typeof source !== 'string' || !source.trim())
    throw Object.assign(new Error('请填写源码'), { status: 400 })

  // selectionErrors 先校验白名单，禁止把语言 ID 当路径或命令使用。
  const { filename } = languageById[language]
  const runtime = runtimes[language]
  const copyIn = { [filename]: { content: source } }
  const analyzed = await sandbox({
    args: ['/usr/bin/python3', 'analyze.py', language, filename],
    copyIn: { ...copyIn, 'analyze.py': { content: analyzer } },
  })
  if (analyzed.status !== 'Accepted')
    throw new Error(analyzed.files?.stderr || analyzed.error || '源码分析未完成')
  const facts = JSON.parse(analyzed.files.stdout)
  const result = {
    mode,
    verdict: 'CE',
    passed: false,
    score: 0,
    maxScore: indicators.reduce((sum, id) => sum + contractById[id].points, 0),
    checks: [],
    cases: [],
    totalCases: mode === 'sample' ? 1 : cases.length,
    timeMs: 0,
    memoryBytes: 0,
    sourceBytes: facts.bytes,
    codeLines: facts.codeLines,
    message: facts.error || '',
  }
  if (facts.error) return result
  result.checks = checkContracts(indicators, facts, source)
  // 编辑时只检查源码；编译和题目数据留给显式运行/提交，避免占满评测队列。
  if (mode === 'validate') {
    result.verdict = 'CHECKED'
    return result
  }

  const cachedFiles = []
  try {
    let runFiles = copyIn
    if (runtime.compile) {
      const compiled = await sandbox({
        args: runtime.compile,
        env: [...environment, ...(runtime.compileEnv || [])],
        cpuLimit: 60e9,
        clockLimit: 90e9,
        memoryLimit: 1536 * MiB,
        copyIn,
        copyOutCached: runtime.artifact ? [runtime.artifact] : [],
      })
      cachedFiles.push(...Object.values(compiled.fileIds || {}))
      if (compiled.status !== 'Accepted') {
        result.verdict = compiled.status === 'Internal Error' ? 'ERROR' : 'CE'
        result.message = compiled.files?.stderr || compiled.files?.stdout || compiled.error || compiled.status
        return result
      }
      if (runtime.artifact) {
        const fileId = compiled.fileIds?.[runtime.artifact]
        if (!fileId) throw new Error('评测服务未返回编译产物')
        runFiles = { [runtime.artifact]: { fileId } }
      }
    }

    result.verdict = 'AC'
    const limit = memoryLimit(indicators, question.memoryLimitBytes)
    const inputs = mode === 'sample' ? cases.slice(0, 1) : cases
    for (const [index, item] of inputs.entries()) {
      const run = await sandbox({
        args: runtime.run,
        copyIn: runFiles,
        cpuLimit: question.timeLimitMs * 1e6,
        clockLimit: question.timeLimitMs * 3e6,
        memoryLimit: limit,
        files: [{ content: item.input }, { name: 'stdout', max: 4096 }, { name: 'stderr', max: 4096 }],
      })
      const verdict =
        run.status === 'Accepted'
          ? run.files.stdout.trim() === item.answer
            ? 'AC'
            : 'WA'
          : statusCodes[run.status] || 'ERROR'
      result.timeMs = Math.max(result.timeMs, run.time / 1e6)
      result.memoryBytes = Math.max(result.memoryBytes, run.memory)
      result.cases.push({ number: index + 1, verdict, timeMs: run.time / 1e6, memoryBytes: run.memory })
      if (verdict !== 'AC') {
        result.verdict = verdict
        result.message = run.files?.stderr || run.error || `第 ${index + 1} 组数据：${verdict}`
        break
      }
    }
    result.checks = checkContracts(
      indicators,
      { ...facts, memoryBytes: result.memoryBytes, memoryExceeded: result.verdict === 'MLE' },
      source,
    )
    if (result.verdict === 'AC') {
      result.score = result.checks
        .filter((item) => ['passed', 'manual'].includes(item.status))
        .reduce((sum, item) => sum + item.points, 0)
      result.passed = result.checks.every((item) => ['passed', 'manual'].includes(item.status))
    }
    return result
  } finally {
    await Promise.allSettled(
      cachedFiles.map((fileId) =>
        fetch(`${process.env.JUDGE_URL || 'http://127.0.0.1:5050'}/file/${encodeURIComponent(fileId)}`, {
          method: 'DELETE',
        }),
      ),
    )
  }
}
