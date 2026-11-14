import { evaluate } from '../server/judge.js'
import { question } from '../server/question.js'
import { languages } from '../shared/languages.js'
import { checksFor } from '../shared/contracts.js'

const budgets = ['memory-1', 'memory-2', 'memory-3'].map((id) => ({
  id,
  bytes: checksFor(id).find((rule) => rule.type === 'maxMemory').limit,
}))
const results = []
for (const { id, name } of languages) {
  const peaks = []
  for (let round = 0; round < 3; round++) {
    const result = await evaluate({ language: id, source: question.templates[id], indicators: [] })
    if (result.verdict !== 'AC') throw new Error(`${name}: ${result.verdict} ${result.message}`)
    peaks.push(result.memoryBytes)
  }
  const peak = Math.max(...peaks)
  const result = {
    language: id,
    peaks,
    fits: budgets.filter(({ bytes }) => peak <= bytes).map(({ id }) => id),
  }
  results.push(result)
  console.error(`${name}: ${peaks.join(' / ')} B; ${result.fits.join(', ') || '无'}`)
}
console.log(JSON.stringify({ hardLimitBytes: question.memoryLimitBytes, budgets, results }, null, 2))
