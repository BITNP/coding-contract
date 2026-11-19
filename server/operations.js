import { pointsOf, timeLimit } from '../shared/contracts.js'

export function createOperation({ id, language, indicators, user, now }) {
  return {
    id,
    user,
    language,
    contracts: indicators,
    phase: 'active',
    score: 0,
    version: 0,
    createdAt: new Date(now).toISOString(),
    deadline: new Date(now + timeLimit(indicators) * 60_000).toISOString(),
    events: [],
  }
}

export function finishOperation(operation, phase, at = operation.deadline) {
  operation.phase = phase
  if (phase === 'passed') operation.score = pointsOf(operation.contracts)
  operation.finishedAt = at < operation.deadline ? at : operation.deadline
}

export function operationView(operation) {
  return {
    id: operation.id,
    language: operation.language,
    contracts: operation.contracts,
    phase: operation.phase,
    score: operation.score,
    version: operation.version,
    deadline: operation.deadline,
    finishedAt: operation.finishedAt,
    submission: operation.submission,
    serverTime: Date.now(),
  }
}
