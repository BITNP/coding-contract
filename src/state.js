import { computed, ref } from 'vue'
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
  if (Array.isArray(stored)) stored = { language: 'cpp', indicators: stored }
} catch {
  /* 旧缓存损坏时使用默认组合 */
}
const validStored = stored && !selectionErrors(stored.indicators, stored.language).length
export const selectedLanguage = ref(validStored ? stored.language || 'cpp' : 'cpp')
export const selectedIds = ref(validStored ? stored.indicators : defaultSelection)
export const selected = computed(() => selectedIds.value.map((id) => contractById[id]))
export const score = computed(() => selected.value.reduce((sum, item) => sum + item.points, 0))
export const keyActive = computed(() => selected.value.some((item) => item.key))
export const user = ref(null)
export const best = ref(0)
export const authAvailable = ref(false)
export const connection = ref('connecting')

// 每次选择变化只计算一次，卡片与提示共用同一份状态；提交作战时再由服务器校验。
export const indicatorStates = computed(() => {
  const ids = new Set(selectedIds.value)
  const groups = new Set(selected.value.map((item) => item.group))
  return Object.fromEntries(
    indicators.map((item) => {
      const selected = ids.has(item.id)
      const reason = unavailableReason(item.id, selectedIds.value, selectedLanguage.value)
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
})

export function setSelection(ids, language = selectedLanguage.value) {
  const errors = selectionErrors(ids, language)
  if (errors.length) throw new Error(errors.join('；'))
  selectedIds.value = ids
  selectedLanguage.value = language
  localStorage.setItem('pioneer-selection', JSON.stringify({ language, indicators: ids }))
}

export function setLanguage(language) {
  const compatible = selectedIds.value.filter((id) => contractById[id].languages.includes(language))
  setSelection(
    compatible.filter((id) => !unavailableReason(id, compatible, language)),
    language,
  )
}

export function toggle(item) {
  if (indicatorStates.value[item.id].locked) return
  const next = selectedIds.value.includes(item.id)
    ? selectedIds.value.filter((id) => id !== item.id)
    : [...selected.value.filter((other) => other.group !== item.group).map((other) => other.id), item.id]
  setSelection(next.filter((id) => !unavailableReason(id, next, selectedLanguage.value)))
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
