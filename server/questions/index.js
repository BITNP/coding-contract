import channelSchedule from './channel-schedule.js'
import maxRise from './max-rise.js'
import maze from './maze.js'

const catalog = [maxRise, channelSchedule, maze]
export const questions = Object.fromEntries(catalog.map((question) => [question.id, question]))

export const publicQuestions = catalog.map(({ id, title, content, timeLimitMs, memoryLimitBytes }) => ({
  id,
  title,
  content,
  timeLimitMs,
  memoryLimitBytes,
}))
