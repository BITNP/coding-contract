let play = null

export const registerSweep = (fn) => {
  play = fn
}

export const sweep = (action) => (play ? play(action) : action())
