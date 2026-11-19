import { onBeforeUnmount, onMounted, ref } from 'vue'
import { api } from './api.js'

const flushMs = 5_000
const heartbeatMs = 30_000
const devtoolsKeys = new Set(['KeyI', 'KeyJ', 'KeyC'])
const browserKeys = new Set(['KeyR', 'KeyW', 'KeyT', 'KeyN'])

function blockedKey({ code, ctrlKey, metaKey, shiftKey, altKey }) {
  const command = ctrlKey || metaKey
  if (code === 'F12' || (devtoolsKeys.has(code) && ((ctrlKey && shiftKey) || (metaKey && altKey))))
    return 'devtools'
  if (code === 'F11' || code === 'F5' || (command && !shiftKey && !altKey && browserKeys.has(code)))
    return 'browser'
}

export function useIntegrity(operationId, { active, snapshot }) {
  const supported = Boolean(document.fullscreenEnabled)
  const fullscreen = ref(Boolean(document.fullscreenElement))
  const away = {}
  let queue = []
  let reported = ''
  let lastSent = 0
  let timer = 0

  function record(type, detail) {
    if (active()) queue.push({ type, at: Date.now(), detail })
  }

  function flush(keepalive = false) {
    if (!active() && !queue.length) return
    const current = snapshot()
    const key = JSON.stringify(current)
    const changed = key !== reported
    if (!queue.length && !changed && Date.now() - lastSent < heartbeatMs) return
    const events = queue.splice(0, 200)
    reported = key
    lastSent = Date.now()
    api.activity(operationId, { events, ...(changed && { snapshot: current }) }, keepalive).catch(() => {
      queue = [...events, ...queue]
      reported = ''
    })
  }

  function leaveFor(kind) {
    if (away[kind]) return
    away[kind] = Date.now()
    record(kind === 'page' ? 'hidden' : 'blur')
  }

  function returnFrom(kind) {
    if (!away[kind]) return
    record(kind === 'page' ? 'visible' : 'focus', Math.max(0, Date.now() - away[kind]))
    delete away[kind]
  }

  const listeners = [
    [document, 'fullscreenchange', () => {
      fullscreen.value = Boolean(document.fullscreenElement)
      if (fullscreen.value && active()) navigator.keyboard?.lock?.().catch(() => {})
      record(fullscreen.value ? 'fullscreen-enter' : 'fullscreen-exit')
      flush()
    }],
    [window, 'keydown', (event) => {
      const kind = active() && blockedKey(event)
      if (!kind) return
      event.preventDefault()
      event.stopPropagation()
      if (kind === 'devtools' && !event.repeat) record('devtools')
    }, true],
    [window, 'contextmenu', (event) => active() && event.preventDefault()],
    [window, 'beforeunload', (event) => active() && event.preventDefault()],
    [document, 'visibilitychange', () => {
      if (document.hidden) leaveFor('page')
      else returnFrom('page')
      flush()
    }],
    [window, 'blur', () => leaveFor('window')],
    [window, 'focus', () => returnFrom('window')],
    [document, 'paste', (event) => record('paste', event.clipboardData?.getData('text').length || 0), true],
    [window, 'pagehide', () => {
      record('leave')
      flush(true)
    }],
  ]

  onMounted(() => {
    for (const [target, type, listener, capture] of listeners) target.addEventListener(type, listener, capture)
    timer = setInterval(() => active() && flush(), flushMs)
  })
  onBeforeUnmount(() => {
    navigator.keyboard?.unlock?.()
    for (const [target, type, listener, capture] of listeners) target.removeEventListener(type, listener, capture)
    clearInterval(timer)
    record('leave')
    flush(true)
  })

  return {
    supported,
    fullscreen,
    record,
    enter: () => document.documentElement.requestFullscreen().catch(() => {}),
  }
}
