const key = 'pioneer:drafts'

function read() {
  try {
    return JSON.parse(localStorage.getItem(key)) || {}
  } catch {
    return {}
  }
}

export const readDraft = (question, language) => read()[`${question}:${language}`]

export function writeDraft(question, language, source) {
  const drafts = read()
  drafts[`${question}:${language}`] = { source, savedAt: Date.now() }
  try {
    localStorage.setItem(key, JSON.stringify(drafts))
    return true
  } catch {
    return false
  }
}
