import channelSchedule from './channel-schedule.js'
import feeTrading from './fee-trading.js'
import maxRise from './max-rise.js'
import maxSubarray from './max-subarray.js'
import maze from './maze.js'

const rounds = [[maxRise], [maxSubarray, maze, channelSchedule], [feeTrading]]
export const questions = Object.fromEntries(rounds.flat().map((question) => [question.id, question]))
export const roundPlan = rounds.map((choices) => choices.map((question) => question.id))

export const publicQuestion = ({ id, title, category, content, timeLimitMs, memoryLimitBytes }) => ({
  id,
  title,
  category,
  content,
  timeLimitMs,
  memoryLimitBytes,
})
