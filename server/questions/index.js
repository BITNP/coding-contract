import channelSchedule from './channel-schedule.js'
import maxRise from './max-rise.js'
import maze from './maze.js'

export const questions = Object.fromEntries(
  [maxRise, channelSchedule, maze].map((question) => [question.id, question]),
)

export const publicQuestion = ({ id, title, category, content, timeLimitMs, memoryLimitBytes }) => ({
  id,
  title,
  category,
  content,
  timeLimitMs,
  memoryLimitBytes,
})
