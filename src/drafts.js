const key = 'pioneer:drafts'

function read() {
  try {
    return JSON.parse(localStorage.getItem(key)) || {}
  } catch {
    return {}
  }
}

export const readDraft = (language) => read()[language]

export function writeDraft(language, source) {
  const drafts = read()
  drafts[language] = { source, savedAt: Date.now() }
  try {
    localStorage.setItem(key, JSON.stringify(drafts))
    return true
  } catch {
    return false
  }
}
