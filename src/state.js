import { ref } from 'vue'
import {
  indicators,
  contractById,
  defaultSelection,
  selectionErrors,
  unavailableReason,
} from '../shared/contracts.js'
import { api } from './api.js'

let stored
try {
  stored = JSON.parse(localStorage.getItem('pioneer-selection'))
} catch {}
const validStored = stored && !selectionErrors(stored.indicators, stored.language).length
export const selectedLanguage = ref(validStored ? stored.language : 'cpp')
export const selectedIds = ref(validStored ? stored.indicators : defaultSelection)
export const user = ref(null)
export const best = ref(0)
export const authAvailable = ref(false)
export const connection = ref('connecting')

// 卡片与提示共用同一份状态；提交作战时再由服务器校验。
export function indicatorStates(ids, language, lockFixed = false) {
  const chosen = new Set(ids)
  const groups = new Set(ids.map((id) => contractById[id].group))
  return Object.fromEntries(
    indicators.map((item) => {
      const selected = chosen.has(item.id)
      const reason = (lockFixed && item.fixed && '开局已锁定') || unavailableReason(item.id, ids, language)
      const conflict = !selected && !reason && groups.has(item.group)
      const hint =
        reason ||
        (selected
          ? '点击取消选择'
          : conflict
            ? '与同组指标冲突，点击替换'
            : item.key
              ? '选入后开放带锁标记的指标'
              : '点击选入')
      return [item.id, { selected, locked: Boolean(reason), conflict, hint }]
    }),
  )
}

export function setSelection(ids, language = selectedLanguage.value) {
  const errors = selectionErrors(ids, language)
  if (errors.length) throw new Error(errors.join('；'))
  selectedIds.value = ids
  selectedLanguage.value = language
  localStorage.setItem('pioneer-selection', JSON.stringify({ language, indicators: ids }))
}


export async function refreshSession() {
  try {
    const session = await api.session()
    user.value = session.user
    authAvailable.value = session.authAvailable
    best.value = session.authAvailable && !session.user ? 0 : (await api.record()).score
    connection.value = 'online'
  } catch {
    connection.value = 'offline'
  }
}
