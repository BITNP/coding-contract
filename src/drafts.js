const draftKey = (question, language) => `pioneer:draft:${question}:${language}`
const selectionKey = 'pioneer:active-question'

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key))
  } catch {
    return null
  }
}

export const readDraft = (question, language) => read(draftKey(question, language))

export function writeDraft(question, language, source) {
  return write(draftKey(question, language), { source, savedAt: Date.now() })
}

export function readSelection(operation) {
  const selection = read(selectionKey)
  return selection?.operation === operation ? selection.question : null
}

export const writeSelection = (operation, question) => write(selectionKey, { operation, question })

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
