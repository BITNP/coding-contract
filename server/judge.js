import { readFileSync } from 'node:fs'
import { selectionErrors } from '../shared/contracts.js'
import { checkContracts, memoryLimit } from '../shared/checks.js'
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

function caseVerdict(run, answer, limit) {
  if (run.memory > limit) return 'MLE'
  if (run.status !== 'Accepted') return statusCodes[run.status] || 'ERROR'
  return run.files.stdout.trim() === answer ? 'AC' : 'WA'
}

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

export async function evaluate({ source, language, indicators, question, mode = 'submit' }) {
  const errors = selectionErrors(indicators, language)
  if (errors.length) throw Object.assign(new Error(errors.join('；')), { status: 400 })
  if (typeof source !== 'string' || !source.trim())
    throw Object.assign(new Error('请填写源码'), { status: 400 })

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
  const inputs = mode === 'sample' ? question.cases.slice(0, 1) : question.cases
  const result = {
    mode,
    verdict: 'CE',
    passed: false,
    checks: [],
    cases: [],
    totalCases: inputs.length,
    timeMs: 0,
    memoryBytes: 0,
    sourceBytes: facts.bytes,
    codeLines: facts.codeLines,
    message: facts.error || '',
  }
  if (facts.error) return result

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
        result.checks = checkContracts(indicators, facts, source)
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
    for (const [index, item] of inputs.entries()) {
      const run = await sandbox({
        args: runtime.run,
        copyIn: runFiles,
        cpuLimit: question.timeLimitMs * 1e6,
        clockLimit: question.timeLimitMs * 3e6,
        // 固定运行环境，合约预算在运行后判定，避免限额改变内核回收行为。
        memoryLimit: question.memoryLimitBytes,
        files: [{ content: item.input }, { name: 'stdout', max: 4096 }, { name: 'stderr', max: 4096 }],
      })
      const verdict = caseVerdict(run, item.answer, limit)
      const timeMs = run.time / 1e6
      result.timeMs = Math.max(result.timeMs, timeMs)
      result.memoryBytes = Math.max(result.memoryBytes, run.memory)
      result.cases.push({ number: index + 1, verdict, timeMs, memoryBytes: run.memory })
      if (verdict !== 'AC') {
        result.verdict = verdict
        const diagnostic = mode === 'sample' && (run.files?.stderr || run.error)
        result.message = diagnostic || `第 ${index + 1} 组数据：${verdict}`
        break
      }
    }
    result.checks = checkContracts(
      indicators,
      { ...facts, memoryBytes: result.memoryBytes, memoryExceeded: result.verdict === 'MLE' },
      source,
    )
    result.passed =
      result.verdict === 'AC' && result.checks.every(({ status }) => status === 'passed' || status === 'manual')
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
