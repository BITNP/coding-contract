<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { NSpin, useMessage } from 'naive-ui'
import {
  Check,
  Code2,
  FileText,
  Play,
  RotateCw,
  Send,
  X,
  Clock3,
  MemoryStick,
  ListChecks,
  Trophy,
  ChevronDown,
  Hourglass,
  LoaderCircle,
} from 'lucide-vue-next'
import { api } from '../api.js'
import { indicators, selectionErrors, checksFor } from '../../shared/contracts.js'
import { languages } from '../../shared/languages.js'
import { checkContracts } from '../../shared/checks.js'
import { best } from '../state.js'
import UiButton from '../components/UiButton.vue'
import UiMenu from '../components/UiMenu.vue'
import CodeEditor from '../components/CodeEditor.vue'
import MarkdownContent from '../components/MarkdownContent.vue'
import IndicatorPopover from '../components/IndicatorPopover.vue'
import LspStatus from '../components/LspStatus.vue'

const route = useRoute()
const message = useMessage()
const operation = ref(null)
const error = ref('')
const loading = ref(true)
const source = ref('')
const language = ref('cpp')
const running = ref('')
const result = ref(null)
const checked = ref(null)
const codeEditor = ref(null)
const analyzed = ref({ source: '', facts: { bytes: 0 } })
const drafts = new Map()
const cursor = ref({ line: 1, column: 1, selected: 0 })
const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'
const operationId = route.params.id
const draftKey = `pioneer:draft:${operationId}`
function readDraft() {
  try {
    return JSON.parse(localStorage.getItem(draftKey))
  } catch {
    return null
  }
}
function saveDraft() {
  if (!operation.value) return
  drafts.set(language.value, source.value)
  try {
    localStorage.setItem(
      draftKey,
      JSON.stringify({ language: language.value, sources: Object.fromEntries(drafts) }),
    )
    return true
  } catch {
    return false
  }
}
let draftTimer = 0
watch([source, language], () => {
  clearTimeout(draftTimer)
  draftTimer = setTimeout(saveDraft, 400)
})
function save() {
  clearTimeout(draftTimer)
  if (saveDraft()) message.success('草稿已保存在本地')
  else message.error('草稿保存失败，请检查浏览器本地存储')
}
const resultAccepted = computed(
  () =>
    result.value && (result.value.mode === 'sample' ? result.value.verdict === 'AC' : result.value.passed),
)
const passedCases = computed(() => result.value?.cases.filter((item) => item.verdict === 'AC').length || 0)
const ids = computed(() => operation.value?.question.contracts || [])
const facts = computed(() => analyzed.value.facts)
const localChecks = computed(() => checkContracts(ids.value, facts.value, analyzed.value.source))
const marks = computed(() =>
  localChecks.value
    .filter((check) => check.status === 'failed')
    .flatMap((check) =>
      check.ranges.map((range) => ({ ...range, message: `**未满足「${check.name}」**\n\n${range.message}` })),
    ),
)
const checks = computed(() => {
  const local = localChecks.value
  return indicators
    .filter((item) => ids.value.includes(item.id))
    .sort((a, b) => a.column - b.column)
    .map((item) => {
      const live = local.find((check) => check.id === item.id)
      const check =
        result.value?.checks.find((check) => check.id === item.id) ||
        (live.status === 'pending'
          ? checked.value?.checks.find((check) => check.id === item.id) || live
          : live)
      return { ...item, ...check }
    })
})
const actions = [
  { key: 'sample', kind: 'dark', icon: Play, label: '运行样例', shortcut: `${mod}Enter` },
  { key: 'submit', kind: 'primary', icon: Send, label: '提交', shortcut: `${mod}Shift+Enter` },
]
const failedChecks = computed(() => checks.value.filter((item) => item.status === 'failed'))
const statusLabels = { passed: '符合', failed: '未满足', pending: '待验证', manual: '自主遵守' }
const statusIcons = { passed: Check, failed: X, pending: Hourglass }
const languageName = computed(() => languages.find((item) => item.id === language.value)?.name)
const languageOptions = computed(() =>
  languages.map((item) => ({
    label: item.name,
    key: item.id,
    disabled: selectionErrors(ids.value, item.id).length > 0,
  })),
)
const mib = (bytes) => (bytes / 1048576).toFixed(2)
const codeLines = computed(() => facts.value.codeLines ?? checked.value?.codeLines ?? '—')
async function load() {
  loading.value = true
  error.value = ''
  try {
    operation.value = await api.operation(operationId)
    const draft = readDraft()
    const submitted = operation.value.submission
    drafts.clear()
    if (submitted) drafts.set(submitted.language, submitted.source)
    for (const [key, code] of Object.entries(draft?.sources || {})) drafts.set(key, code)
    language.value = draft?.language || submitted?.language || operation.value.language
    source.value = drafts.get(language.value) ?? operation.value.question.templates[language.value]
    result.value =
      submitted?.language === language.value && submitted.source === source.value ? submitted.result : null
    checked.value = result.value
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
function changeLanguage(value) {
  if (value === language.value) return
  drafts.set(language.value, source.value)
  language.value = value
  source.value = drafts.get(value) ?? operation.value.question.templates[value]
  saveDraft()
}
watch(
  [source, language, codeEditor],
  ([code, lang, editor], [oldCode, oldLang], onCleanup) => {
    if (code !== oldCode || lang !== oldLang) {
      result.value = null
      if (checked.value)
        checked.value = {
          ...checked.value,
          checks: checked.value.checks.filter(
            (check) => !checksFor(check.id).some((rule) => rule.type === 'maxMemory'),
          ),
        }
    }
    if (!editor) return
    let current = true
    const timer = setTimeout(async () => {
      const next = await editor.analyze(code, lang)
      if (!current) return
      analyzed.value = { source: code, facts: next }
      checked.value = {
        checks: checkContracts(ids.value, next, code).map((check) =>
          check.status === 'pending'
            ? checked.value?.checks.find((previous) => previous.id === check.id) || check
            : check,
        ),
      }
    }, 150)
    onCleanup(() => {
      current = false
      clearTimeout(timer)
    })
  },
  { flush: 'sync' },
)
const blocked = (action) =>
  (Boolean(running.value) && running.value !== action) ||
  (action === 'submit' && failedChecks.value.length > 0)
const hint = (action) =>
  action.key === 'submit' && failedChecks.value.length
    ? `未满足${failedChecks.value.map((item) => `「${item.name}」`).join('')}，暂不可提交`
    : action.shortcut
async function run(action) {
  if (running.value || blocked(action)) return
  const errors = selectionErrors(ids.value, language.value)
  if (errors.length) return message.warning(errors.join('；'))
  running.value = action
  result.value = null
  try {
    result.value = await api[action](operationId, { source: source.value, language: language.value })
    checked.value = result.value
    if (action === 'submit') {
      best.value = (await api.record()).score
      message.success('提交已记录')
    }
  } catch (error) {
    message.error(error.message)
  } finally {
    running.value = ''
  }
}
onMounted(load)
onBeforeUnmount(() => {
  clearTimeout(draftTimer)
  saveDraft()
})
</script>

<template>
  <main class="operation-view">
    <div v-if="loading" class="terminal-state">
      <NSpin size="large" />
      <p>正在接收作战任务…</p>
    </div>
    <div v-else-if="error" class="terminal-state">
      <p>{{ error }}</p>
      <UiButton kind="primary" @click="load"><RotateCw :size="16" />重新连接</UiButton>
    </div>

    <div v-else class="terminal-layout" :class="{ 'has-effects': checks.length }">
      <article class="panel brief-panel">
        <header class="panel-heading">
          <h1>{{ operation.question.title }}</h1>
          <span class="limits num"
            >{{ operation.question.timeLimitMs }} ms ·
            {{ operation.question.memoryLimitBytes / 1048576 }} MiB</span
          >
        </header>
        <div v-scroll-fade class="brief-content">
          <MarkdownContent :content="operation.question.content" />
        </div>
      </article>

      <section class="panel work-panel" aria-label="代码编辑与验证">
        <header class="panel-heading">
          <h2><Code2 :size="18" />代码编辑</h2>
          <div class="editor-tools">
            <LspStatus />
            <UiMenu
              v-slot="{ toggle }"
              :options="languageOptions"
              :disabled="Boolean(running)"
              placement="bottom-end"
              max-height="min(440px, 60vh)"
              @select="changeLanguage"
            >
              <button
                class="language-select"
                :disabled="Boolean(running)"
                :aria-label="`编程语言：${languageName}`"
                @click="toggle"
              >
                {{ languageName }}<ChevronDown :size="16" />
              </button>
            </UiMenu>
          </div>
        </header>

        <div class="editor-frame">
          <CodeEditor
            ref="codeEditor"
            v-model="source"
            :language="language"
            :disabled="Boolean(running)"
            :marks="marks"
            @run="run"
            @save="save"
            @cursor="cursor = $event"
          />
        </div>

        <details v-if="result" class="execution-result" :class="resultAccepted ? 'accepted' : 'rejected'">
          <summary class="result-summary" aria-label="展开或收起评测详情">
            <strong aria-live="polite">
              <component :is="resultAccepted ? Check : X" :size="16" />{{ result.verdict }}
              <small v-if="result.verdict === 'AC' && !resultAccepted">指标未满足</small>
            </strong>
            <span :title="result.mode === 'sample' ? '样例通过数 / 样例总数' : '通过数据 / 全部数据'"
              ><ListChecks :size="14" /><i class="num"
                >{{ passedCases }}/{{ result.totalCases ?? result.cases.length }}</i
              ></span
            >
            <span title="最长运行时间"
              ><Clock3 :size="14" /><i class="num">{{ result.timeMs.toFixed(1) }} ms</i></span
            >
            <span title="峰值内存"
              ><MemoryStick :size="14" /><i class="num">{{ mib(result.memoryBytes) }} MiB</i></span
            >
            <b v-if="result.mode !== 'sample'" title="已获分 / 指标总分"
              ><Trophy :size="14" /><i class="num"
                >{{ result.score }}<small>/{{ result.maxScore }}</small></i
              ></b
            >
            <ChevronDown class="result-chevron" :size="16" />
          </summary>
          <div class="result-details">
            <pre v-if="result.message">{{ result.message }}</pre>
            <table v-if="result.cases.length">
              <thead>
                <tr>
                  <th>数据</th>
                  <th>结果</th>
                  <th>耗时</th>
                  <th>内存</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in result.cases"
                  :key="item.number"
                  :class="{ failed: item.verdict !== 'AC' }"
                >
                  <td>#{{ item.number }}</td>
                  <td>{{ item.verdict }}</td>
                  <td>{{ item.timeMs.toFixed(1) }} ms</td>
                  <td>{{ mib(item.memoryBytes) }} MiB</td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>

        <footer class="terminal-actions">
          <div class="editor-status">
            <span class="num"
              >行 {{ cursor.line }}，列 {{ cursor.column
              }}<template v-if="cursor.selected">（已选 {{ cursor.selected }}）</template></span
            >
            <span class="num" :title="`${facts.bytes} 字节 · ${codeLines} 有效行`">
              <FileText :size="14" />{{ running ? '评测中…' : `${facts.bytes} B · ${codeLines} L` }}
            </span>
          </div>
          <UiButton
            v-for="action in actions"
            :key="action.key"
            :kind="action.kind"
            class="run-button"
            :class="{ busy: running === action.key }"
            :disabled="blocked(action.key)"
            :aria-busy="running === action.key"
            :title="hint(action)"
            @click="run(action.key)"
          >
            <component
              :is="running === action.key ? LoaderCircle : action.icon"
              :class="{ spin: running === action.key }"
              :size="16"
            />{{ action.label }}
          </UiButton>
        </footer>
      </section>

      <aside v-if="checks.length" class="effect-rail" aria-label="作战指标">
        <div class="effects-score">
          <img src="/assets/risk-level.png" alt="" />
          <span>指标总计</span>
          <strong class="num">{{ String(operation.question.score).padStart(2, '0') }}</strong>
        </div>
        <ul v-scroll-fade class="effect-list">
          <IndicatorPopover v-for="item in checks" :key="item.id" :item="item" placement="left">
            <li
              class="effect-tab"
              :class="item.status"
              tabindex="0"
              :aria-label="`${item.name}，${statusLabels[item.status]}`"
            >
              <img :src="item.icon" alt="" />
              <div class="effect-copy">
                <b>{{ item.name }}</b>
                <span class="level-badge" :data-level="item.level"
                  >{{ item.level }}<img src="/assets/risk-level.png" alt=""
                /></span>
              </div>
              <component
                :is="statusIcons[item.status]"
                v-if="statusIcons[item.status]"
                class="effect-status"
                :size="20"
                :stroke-width="2.5"
              />
            </li>
            <template #hint>
              <small :class="['effect-hint', item.status]">
                <component
                  :is="statusIcons[item.status]"
                  v-if="statusIcons[item.status]"
                  :size="14"
                  :stroke-width="2.5"
                />{{ statusLabels[item.status]
                }}<template v-if="item.messages.length"> · {{ item.messages.join('；') }}</template>
              </small>
            </template>
          </IndicatorPopover>
        </ul>
      </aside>
    </div>
  </main>
</template>

<style scoped>
:global(.app-shell:has(.operation-view)) {
  min-width: 0;
}
.operation-view {
  padding-top: var(--space-4);
}
.terminal-layout {
  display: grid;
  grid-template-columns: minmax(300px, 0.8fr) minmax(0, 1.6fr);
  gap: var(--space-3);
  height: calc(100dvh - var(--header-height) - var(--page-bottom) - var(--space-4) - 8px);
  min-height: 460px;
}
.terminal-layout.has-effects {
  grid-template-columns: minmax(300px, 0.8fr) minmax(0, 1.6fr) clamp(220px, 15vw, 270px);
}

.panel {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 3px;
}
.brief-panel {
  border-top: 2px solid var(--orange);
  overflow: hidden;
}
.work-panel {
  position: relative;
  z-index: 2;
  border-top: 2px solid #5d5e60;
  box-shadow: 12px 0 20px -8px #000c;
}
.panel-heading {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: 56px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--line);
}
.panel-heading h1,
.panel-heading h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  font-size: 18px;
  font-weight: 500;
  line-height: 1.35;
  letter-spacing: 0.02em;
  color: var(--text);
}
.panel-heading h2 svg {
  color: var(--muted);
}
.limits {
  flex: none;
  font-size: 14px;
  color: var(--muted);
}
.brief-content {
  flex: 1;
  overflow: auto;
  padding: 18px 20px 24px;
}

.editor-tools {
  display: flex;
  align-items: center;
  gap: 12px;
}
.language-select {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 156px;
  height: 36px;
  padding: 0 14px 0 20px;
  border: 0;
  border-radius: 18px;
  background: var(--light);
  color: #2a2b2e;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.15s;
}
.language-select:hover:not(:disabled) {
  background: #fff;
}
.language-select:disabled {
  opacity: 0.5;
  cursor: default;
}

.editor-frame {
  flex: 1;
  min-height: 200px;
  position: relative;
  background: #141517;
}
.editor-frame > * {
  position: absolute;
  inset: 0;
}

.execution-result {
  flex: none;
  border-top: 1px solid #e5003240;
  background: linear-gradient(90deg, #e5003218, transparent 70%);
}
.execution-result.accepted {
  border-color: #b9cf8a40;
  background: linear-gradient(90deg, #b9cf8a14, transparent 70%);
}
.result-summary {
  display: flex;
  align-items: center;
  gap: 18px;
  min-height: 40px;
  padding: 6px 18px;
  cursor: pointer;
  list-style: none;
  font-size: 13px;
  color: var(--muted);
}
.result-summary::-webkit-details-marker {
  display: none;
}
.result-summary > * {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.result-summary i {
  font-style: normal;
  font-size: 15px;
  color: var(--soft);
}
.result-summary > strong {
  font: 400 18px var(--font-num);
  color: #ff6f86;
}
.accepted .result-summary > strong {
  color: var(--green);
}
.result-summary strong small {
  font: 400 12px var(--font-sans);
  color: var(--muted);
}
.result-summary small {
  color: var(--muted);
}
.result-summary > b {
  margin-left: auto;
  font-weight: 400;
}
.result-chevron {
  margin-left: auto;
  transition: transform 0.15s;
}
.result-summary > b + .result-chevron {
  margin-left: 0;
}
.execution-result[open] .result-chevron {
  transform: rotate(180deg);
}
.result-details {
  max-height: 180px;
  overflow: auto;
  padding: 0 18px 12px;
}
.result-details pre {
  margin: 4px 0 10px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font: 12px/1.6 var(--mono);
  color: #f0a3a3;
}
.result-details table {
  width: 100%;
  border-collapse: collapse;
  font: 400 14px/1.5 var(--font-num);
  color: var(--soft);
  text-align: left;
}
.result-details th {
  font: 400 12px var(--font-sans);
  color: var(--muted);
}
.result-details td,
.result-details th {
  padding: 4px 12px 4px 0;
  border-bottom: 1px solid #ffffff0a;
}
.result-details tr.failed td:nth-child(2) {
  color: #ff6f86;
}

.terminal-actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px 10px 18px;
  border-top: 1px solid var(--line);
}
.editor-status {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-right: auto;
  font-size: 14px;
  color: var(--muted);
  white-space: nowrap;
}
.editor-status > span {
  display: flex;
  align-items: center;
  gap: 8px;
}
.terminal-actions .ui-button {
  min-width: 112px;
  height: 38px;
}
.run-button.busy {
  pointer-events: none;
}

.effect-rail {
  --tuck: 16px;
  position: relative;
  z-index: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-left: calc(-1 * (var(--space-3) + var(--tuck)));
}
.effects-score {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 56px;
  padding: 0 2px 0 calc(var(--tuck) + 14px);
}
.effects-score img {
  width: 30px;
  height: 32px;
  opacity: 0.8;
}
.effects-score span {
  font-size: 14px;
  color: var(--soft);
}
.effects-score strong {
  margin-left: auto;
  font-size: 44px;
  font-weight: 400;
  line-height: 1;
}
.effect-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.effect-tab {
  flex: none;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 58px;
  padding: 0 14px 0 calc(var(--tuck) + 12px);
  border-radius: 0 3px 3px 0;
  cursor: default;
  outline: none;
  background: linear-gradient(135deg, #3a3b3d, #313234);
  transition:
    transform 0.15s,
    filter 0.15s;
}
.effect-tab::after {
  content: '';
  position: absolute;
  inset: 0 0 0 auto;
  width: 40px;
  pointer-events: none;
  opacity: 0.04;
  background: repeating-linear-gradient(135deg, transparent 0 15px, white 15px 26px);
}
.effect-tab:hover,
.effect-tab:focus-visible {
  transform: translateX(6px);
  filter: brightness(1.08);
}
.effect-tab > img {
  width: 30px;
  height: 32px;
  flex: none;
  opacity: 0.85;
}
.effect-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.effect-copy b {
  max-width: 100%;
  font-size: 15px;
  font-weight: 400;
  line-height: 1.3;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.effect-copy .level-badge {
  width: 38px;
  height: 15px;
  gap: 3px;
  font-size: 13px;
  line-height: 15px;
}
.effect-copy .level-badge img {
  width: 13px;
  height: 12px;
}
.effect-status {
  flex: none;
  color: var(--muted);
}
.effect-tab.passed {
  background: linear-gradient(135deg, #3c4433, #2f3429);
}
.effect-tab.passed .effect-status {
  color: var(--green);
}
.effect-tab.failed {
  background: linear-gradient(155deg, #b81716, #a10810 75%);
}
.effect-tab.failed .effect-status {
  color: #fff;
}
.effect-tab.failed > img {
  opacity: 1;
}
.effect-hint.passed {
  color: var(--green);
}
.effect-hint.failed {
  color: #ff6f86;
}

.terminal-state {
  min-height: 70vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  font-size: 15px;
  color: var(--muted);
}

@media (max-width: 1280px) {
  .terminal-layout.has-effects {
    grid-template-columns: minmax(260px, 0.75fr) minmax(0, 1.5fr) 220px;
  }
}
@media (max-width: 960px) {
  .terminal-layout,
  .terminal-layout.has-effects {
    grid-template-columns: 1fr;
    height: auto;
  }
  .brief-content {
    max-height: 380px;
  }
  .work-panel {
    height: clamp(380px, 60dvh, 580px);
  }
  .effect-rail {
    margin-left: 0;
    --tuck: 0px;
  }
  .effect-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  }
  .effect-tab {
    border-radius: 3px;
    padding-left: 12px;
  }
}
@media (max-width: 480px) {
  :global(.app-shell:has(.operation-view)) {
    --page-inset: 12px;
  }
}
</style>
