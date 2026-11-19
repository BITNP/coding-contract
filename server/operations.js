import { timeLimit } from '../shared/contracts.js'
import { publicQuestion, questions, roundPlan } from './questions/index.js'

function enter(round, contracts, language) {
  round.contracts = contracts
  round.language = language
  round.question = round.choices.length === 1 ? round.choices[0] : null
  round.phase = round.question ? 'active' : 'choosing'
}

export function createOperation({ id, language, indicators, user, now }) {
  const rounds = roundPlan.map((choices) => ({ choices, phase: 'pending' }))
  enter(rounds[0], indicators, language)
  return {
    id,
    version: 0,
    total: 0,
    createdAt: new Date(now).toISOString(),
    deadline: new Date(now + timeLimit(indicators) * 60_000).toISOString(),
    user,
    current: 0,
    rounds,
    events: [],
  }
}

export const currentRound = (operation) => operation.rounds[operation.current]

export const roundSummary = (operation) =>
  operation.rounds.map(({ question = null, phase, score = 0, contracts = [] }) => ({
    title: question ? questions[question].title : null,
    phase,
    score,
    contracts,
  }))

export const closed = (operation, graceMs = 0, now = Date.now()) =>
  Boolean(operation.finishedAt) || now - Date.parse(operation.deadline) > graceMs

export function conclude(operation, outcome, at, now = Date.parse(at)) {
  const round = Object.assign(currentRound(operation), outcome)
  operation.total += round.score
  const next = operation.rounds[operation.current + 1]
  if (next && now < Date.parse(operation.deadline)) {
    operation.current++
    enter(next, round.contracts, round.language)
  } else {
    operation.finishedAt = !next && at < operation.deadline ? at : operation.deadline
  }
}

export function expire(operation) {
  Object.assign(currentRound(operation), { phase: 'expired', score: 0 })
  operation.finishedAt = operation.deadline
}

function roundView({ choices, question, contracts, ...round }, index) {
  if (round.phase === 'pending') return { index, phase: 'pending' }
  return {
    ...round,
    index,
    contracts,
    question: question && publicQuestion(questions[question]),
    ...(round.phase === 'choosing' && { choices: choices.map((id) => publicQuestion(questions[id])) }),
  }
}

export function operationView(operation, now = Date.now()) {
  const { id, user, current, version, total, createdAt, deadline, finishedAt, rounds } = operation
  return {
    id,
    user,
    current,
    version,
    total,
    createdAt,
    deadline,
    finishedAt,
    serverTime: now,
    rounds: rounds.map(roundView),
  }
}
