import { flaggedActivity } from '../shared/labels.js'

// 管理台与裁判端共用同一套行为统计，避免两边对同一份事件得出不同结论。
export function flaggedCounts(events = []) {
  const counts = Object.fromEntries(flaggedActivity.map((type) => [type, 0]))
  for (const event of events) if (Object.hasOwn(counts, event.type)) counts[event.type]++
  return counts
}

export function awayMs(events = []) {
  const spans = events
    .filter((event) => (event.type === 'visible' || event.type === 'focus') && event.detail > 0)
    .map((event) => [event.at - event.detail, event.at])
    .sort((a, b) => a[0] - b[0])
  let total = 0
  let end = -Infinity
  for (const [from, to] of spans) {
    total += Math.max(0, to - Math.max(from, end))
    end = Math.max(end, to)
  }
  return total
}
