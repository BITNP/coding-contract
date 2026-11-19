import { timeLimit } from '../shared/contracts.js'
import { publicQuestion, questions } from './questions/index.js'

const choices = Object.values(questions).map(publicQuestion)

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

export function finishOperation(operation, phase, at, score = 0) {
  operation.phase = phase
  operation.score = score
  operation.finishedAt = at < operation.deadline ? at : operation.deadline
}

export function operationView(operation) {
  const {
    id,
    user,
    language,
    contracts,
    phase,
    score,
    version,
    createdAt,
    deadline,
    finishedAt,
    submission,
  } = operation
  return {
    id,
    user,
    language,
    contracts,
    phase,
    score,
    version,
    createdAt,
    deadline,
    finishedAt,
    submission,
    questions: choices,
    serverTime: Date.now(),
  }
}
