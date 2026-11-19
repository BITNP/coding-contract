export function defineQuestion(statement, buildCases) {
  let cases
  return {
    ...statement,
    timeLimitMs: 2000,
    memoryLimitBytes: 256 * 1024 * 1024,
    get cases() {
      return (cases ??= buildCases())
    },
  }
}

export function sequenceCases(sequences, solve) {
  return sequences.map((values, index) => {
    const row = values.join(' ')
    const input = index === sequences.length - 1 ? row.replace(' ', '\n') : row
    return { input: `${values.length}\n${input}\n`, answer: String(solve(values)) }
  })
}

export function random(seed) {
  let state = seed >>> 0
  const next = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0)
  const int = (min, max) => min + Math.floor((next() / 2 ** 32) * (max - min + 1))
  return {
    next,
    int,
    ints: (length, min, max) => Array.from({ length }, () => int(min, max)),
    chance: (probability) => next() / 2 ** 32 < probability,
  }
}
