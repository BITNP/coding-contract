import assert from 'node:assert/strict'
import { test } from 'node:test'
import { languages } from '../shared/languages.js'
import { indicators, checksFor, selectionErrors } from '../shared/contracts.js'
import { checkContracts } from '../shared/checks.js'
import { sourceFacts } from '../src/sourceFacts.js'
import { evaluate } from '../server/judge.js'
import { question } from '../server/question.js'
import { runtimes } from '../server/runtimes.js'

test('每种可选语言都有模板、运行配置和可用的通用指标', () => {
  for (const language of languages) {
    assert.ok(question.templates[language.id]?.trim(), language.id)
    assert.ok(runtimes[language.id]?.run.length, language.id)
    assert.deepEqual(
      selectionErrors(['ancient-3', 'source-1', 'lines-1', 'memory-1', 'brackets-2'], language.id),
      [],
    )
  }
})

test('语法指标及继承规则仅开放给具备精确分析器的语言', () => {
  for (const indicator of indicators) {
    if (!checksFor(indicator.id).some((rule) => ['names', 'syntax', 'operators'].includes(rule.type)))
      continue
    for (const language of languages) {
      if (!language.analysis) {
        assert.ok(
          selectionErrors(['ancient-3', indicator.id], language.id).length,
          `${language.id}: ${indicator.id}`,
        )
      }
    }
  }
  assert.deepEqual(selectionErrors(['ancient-3', 'arithmetic-3', 'memory-3'], 'c'), [])
  assert.deepEqual(selectionErrors(['ancient-3', 'memory-3'], 'rust'), [])
  assert.ok(selectionErrors(['ancient-3', 'memory-3'], 'java').length)
})

test('无效语言、词条、重复组和缺失依赖由服务端拒绝', async () => {
  for (const language of ['__proto__', 'constructor', '../../bin/sh', '', null]) {
    await assert.rejects(evaluate({ source: 'anything', language, indicators: [] }), { status: 400 })
  }
  for (const ids of [['unknown'], ['source-1', 'source-2'], ['linear-2'], 'source-1']) {
    assert.ok(selectionErrors(ids, 'javascript').length)
  }
  await assert.rejects(evaluate({ source: '  ', language: 'c', indicators: [] }), { status: 400 })
})

test('非 C 系语法不会误用 C++ 的本地行数分析', () => {
  assert.equal(sourceFacts('print("中文")\n# comment\n', 'python').codeLines, 1)
  const facts = sourceFacts('puts "中文"\n', 'ruby')
  assert.equal(facts.bytes, Buffer.byteLength('puts "中文"\n'))
  assert.equal(facts.codeLines, undefined)
})

test('缺失分析数据保持待验证，不计为指标通过', () => {
  const checks = checkContracts(['lines-1', 'source-3'], { bytes: 300 }, '')
  assert.equal(checks[0].status, 'pending')
  assert.equal(checks[1].status, 'failed')
})
