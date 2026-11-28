import { randomInt } from 'node:crypto'
import { automaticPoints, pointsOf, requiresReferee, timeLimit } from '../shared/contracts.js'

// 裁判口头核对用的配对码，去掉易混淆字符。
const codeAlphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const pairCode = () => Array.from({ length: 4 }, () => codeAlphabet[randomInt(codeAlphabet.length)]).join('')

export function createOperation({ id, language, indicators, user, now }) {
  return {
    id,
    user,
    language,
    contracts: indicators,
    phase: 'active',
    score: 0,
    selectedScore: 0,
    pairCode: pairCode(),
    referee: null,
    review: null,
    version: 0,
    createdAt: new Date(now).toISOString(),
    deadline: new Date(now + timeLimit(indicators) * 60_000).toISOString(),
    events: [],
  }
}

// 含线下核验条款时：
// - 未配对：只有能由后端核验的条款计入有效成绩；
// - 已配对：先记 0 分，等裁判确认后才计入所选成绩，驳回则保持 0 分。
export function finishOperation(operation, phase, at = operation.deadline) {
  operation.phase = phase
  operation.finishedAt = at < operation.deadline ? at : operation.deadline
  if (phase !== 'passed') {
    operation.score = 0
    return
  }
  operation.selectedScore = pointsOf(operation.contracts)
  if (!requiresReferee(operation.contracts)) {
    operation.score = operation.selectedScore
    operation.review = null
  } else if (operation.referee) {
    operation.score = 0
    operation.review = { status: 'pending', at: operation.finishedAt }
  } else {
    operation.score = automaticPoints(operation.contracts)
    operation.review = null
  }
}

export function operationView(operation) {
  const needsReferee = requiresReferee(operation.contracts)
  return {
    id: operation.id,
    language: operation.language,
    contracts: operation.contracts,
    phase: operation.phase,
    score: operation.score,
    selectedScore: operation.selectedScore ?? 0,
    needsReferee,
    automaticScore: automaticPoints(operation.contracts),
    pairCode: needsReferee && !operation.finishedAt ? operation.pairCode : null,
    referee: operation.referee ? { id: operation.referee.id, name: operation.referee.name } : null,
    review: operation.review || null,
    version: operation.version,
    deadline: operation.deadline,
    finishedAt: operation.finishedAt,
    submission: operation.submission,
    serverTime: Date.now(),
  }
}
