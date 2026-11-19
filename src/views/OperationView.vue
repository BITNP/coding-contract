<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NSpin, useMessage } from 'naive-ui'
import {
  Check,
  Code2,
  FileText,
  Flag,
  Play,
  RotateCw,
  Send,
  X,
  Clock3,
  MemoryStick,
  ListChecks,
  ChevronDown,
  Hourglass,
  LoaderCircle,
  LogOut,
  Ellipsis,
  SlidersHorizontal,
} from 'lucide-vue-next'
import { api } from '../api.js'
import {
  contractById,
  pointsOf,
  senseLevel,
  submitGraceMs,
} from '../../shared/contracts.js'
import { languageById, templates } from '../../shared/languages.js'
import { phaseLabels } from '../../shared/labels.js'
import { checkContracts } from '../../shared/checks.js'
import { best } from '../state.js'
import { readDraft, writeDraft, readSelection, writeSelection } from '../drafts.js'
import { sweep } from '../sweep.js'
import { useIntegrity } from '../integrity.js'
import UiButton from '../components/UiButton.vue'
import UiMenu from '../components/UiMenu.vue'
import CodeEditor from '../components/CodeEditor.vue'
import MarkdownContent from '../components/MarkdownContent.vue'
import IndicatorPopover from '../components/IndicatorPopover.vue'
import EditorSenses from '../components/EditorSenses.vue'
import ContractPanel from '../components/ContractPanel.vue'
import GameDialog from '../components/GameDialog.vue'
import IntelDialog from '../components/IntelDialog.vue'
import Digits from '../components/Digits.vue'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const operation = ref(null)
const error = ref('')
const loading = ref(true)
const source = ref('')
const running = ref('')
const sample = ref(null)
const codeEditor = ref(null)
const questions = ref([])
const selectedId = ref('')
const adjusting = ref(false)
const panelReady = ref(false)
const confirmOpen = ref(false)
const intelOpen = ref(false)
const facts = ref({})
const cursor = ref({ line: 1, column: 1, selected: 0 })
const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'
const operationId = route.params.id

const finalSubmission = computed(() => operation.value?.finishedAt && operation.value.submission)
const language = computed(() => finalSubmission.value?.language ?? operation.value?.language)
const question = computed(() =>
  questions.value.find(({ id }) => id === (finalSubmission.value?.question ?? selectedId.value)),
)
const questionOptions = computed(() => questions.value.map(({ id, title }) => ({ key: id, label: title })))
const submission = computed(() => {
  const last = operation.value?.submission
  return last && last.question === question.value?.id && last.language === language.value ? last : null
})
const ids = computed(() => finalSubmission.value?.contracts ?? operation.value?.contracts ?? [])
const points = computed(() => pointsOf(ids.value))
const masked = computed(() => senseLevel(ids.value))
const pad = (value) => String(value).padStart(2, '0')

let baseline = ''
let draftTimer = 0
function saveDraft() {
  clearTimeout(draftTimer)
  if (!question.value || source.value === baseline) return true
  if (!writeDraft(question.value.id, language.value, source.value)) return false
  baseline = source.value
  return true
}
watch(source, () => {
  clearTimeout(draftTimer)
  draftTimer = setTimeout(saveDraft, 400)
})
function save() {
  if (saveDraft()) message.success('草稿已保存在本地')
  else message.error('草稿保存失败，请检查浏览器本地存储')
}
watch([() => question.value?.id, language, finalSubmission], ([id, lang, final]) => {
  const draft = readDraft(id, lang)
  const last = submission.value
  const useDraft = draft && !final && (!last || draft.savedAt + clockOffset.value > Date.parse(last.submittedAt))
  source.value = baseline = useDraft ? draft.source : last?.source ?? templates[lang]
})
function selectQuestion(id) {
  if (ended.value || id === question.value.id) return
  if (!saveDraft()) return message.error('草稿保存失败，请检查浏览器本地存储')
  selectedId.value = id
  writeSelection(operationId, id)
}
function apply({ questions: catalog, ...next }) {
  saveDraft()
  if (catalog) {
    const preferred = selectedId.value || readSelection(operationId)
    selectedId.value = catalog.some(({ id }) => id === preferred)
      ? preferred
      : next.submission?.question ?? catalog[0].id
    questions.value = catalog
  }
  operation.value = next
  clockOffset.value = next.serverTime - Date.now()
  sample.value = null
}

const result = computed(() => {
  if (running.value === 'sample' || running.value === 'submit') return null
  if (sample.value) return sample.value
  const last = submission.value
  return last && last.source === source.value &&
    last.contracts.length === ids.value.length && last.contracts.every((id) => ids.value.includes(id))
    ? last.result : null
})
const resultAccepted = computed(
  () =>
    result.value && (result.value.mode === 'sample' ? result.value.verdict === 'AC' : result.value.passed),
)
const passedCases = computed(() => result.value?.cases.filter((item) => item.verdict === 'AC').length || 0)

const clockOffset = ref(0)
const now = ref(Date.now())
const settlementOpen = ref(false)
const finished = computed(() => Boolean(operation.value?.finishedAt))
const deadline = computed(() => operation.value && Date.parse(operation.value.deadline))
const remaining = computed(() => deadline.value && Math.max(0, deadline.value - now.value - clockOffset.value))
const timeUp = computed(() => remaining.value === 0)
const ended = computed(() => finished.value || timeUp.value)
const urgent = computed(() => remaining.value < 300_000)
const countdown = computed(() => {
  const seconds = Math.ceil(remaining.value / 1000)
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`
})
let clock = 0
let task = Promise.resolve()
let sampleRequest
let refreshTimer = 0
async function refreshSettlement() {
  if (!clock || finished.value) return
  try {
    apply(await api.operation(operationId))
  } catch (e) {
    message.error(e.message)
  }
  if (clock && !finished.value) {
    const untilGraceEnds = deadline.value + submitGraceMs - Date.now() - clockOffset.value
    refreshTimer = setTimeout(refreshSettlement, Math.max(3000, untilGraceEnds + 100))
  }
}
watch(timeUp, async (value) => {
  if (!value || finished.value) return
  adjusting.value = false
  confirmOpen.value = false
  const submitting = running.value === 'submit'
  sampleRequest?.abort()
  await task
  const overdue = Date.now() + clockOffset.value - deadline.value
  if (!clock || finished.value) return
  if (!submitting && overdue < submitGraceMs && source.value.trim()) await submitCode('submit')
  await refreshSettlement()
})
watch(finished, async (value) => {
  if (!value) return
  adjusting.value = confirmOpen.value = false
  try {
    best.value = (await api.record()).score
  } catch (e) {
    message.error(e.message)
  }
  settlementOpen.value = true
})

const live = computed(() => Boolean(operation.value) && !ended.value)
const integrity = useIntegrity(operationId, {
  active: () => live.value,
  snapshot: () => ({ question: question.value?.id, source: source.value, language: language.value }),
})
const { fullscreen } = integrity
const fullscreenRequired = computed(() => live.value && integrity.supported && !fullscreen.value)
const localChecks = computed(() => checkContracts(ids.value, facts.value, source.value))
const marks = computed(() =>
  localChecks.value
    .filter((check) => check.status === 'failed')
    .flatMap((check) =>
      check.ranges.map((range) => ({ ...range, message: `**未满足「${contractById[check.id].name}」**\n\n${range.message}` })),
    ),
)
const checks = computed(() => {
  const statuses = result.value?.checks.length ? result.value.checks : localChecks.value
  return statuses.map((check) => ({ ...contractById[check.id], ...check })).sort((a, b) => a.column - b.column)
})
const actions = [
  { key: 'sample', kind: 'dark', icon: Play, label: '运行样例', shortcut: `${mod}Enter` },
  { key: 'submit', kind: 'primary', icon: Send, label: '提交', shortcut: `${mod}Shift+Enter` },
]
const failedChecks = computed(() => checks.value.filter((item) => item.status === 'failed'))
const statusLabels = { passed: '符合', failed: '未满足', pending: '待验证', manual: '自主遵守' }
const statusIcons = { passed: Check, failed: X, pending: Hourglass }
const languageName = computed(() => languageById[language.value]?.name)
const mib = (bytes) => (bytes / 1048576).toFixed(2)
const sourceBytes = computed(() => facts.value.bytes ?? result.value?.sourceBytes ?? '—')
const codeLines = computed(() => facts.value.codeLines ?? result.value?.codeLines ?? '—')
async function load() {
  loading.value = true
  error.value = ''
  try {
    const first = !operation.value
    apply(await api.operation(operationId))
    if (first) integrity.record('open')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
const toggleView = () =>
  sweep(() => {
    if (ended.value) return
    panelReady.value = true
    adjusting.value = !adjusting.value
  })
function adjust(indicators, nextLanguage) {
  if (nextLanguage !== language.value && !saveDraft()) return message.error('草稿保存失败，请检查浏览器本地存储')
  return act('contracts', { indicators, language: nextLanguage })
}
function abandon() {
  confirmOpen.value = false
  act('abandon')
}
const leave = () => (ended.value ? router.push('/') : (confirmOpen.value = true))
watch(
  [source, language, codeEditor, () => question.value?.id],
  ([code, lang, editor], _, onCleanup) => {
    sample.value = null
    facts.value = {}
    if (!editor) return
    let current = true
    const timer = setTimeout(async () => {
      const next = await editor.analyze(code, lang)
      if (!current) return
      facts.value = next
    }, 150)
    onCleanup(() => {
      current = false
      clearTimeout(timer)
    })
  },
  { flush: 'sync' },
)
const blocked = (action) =>
  ended.value ||
  Boolean(running.value) ||
  (action === 'submit' && failedChecks.value.length > 0)
const hint = (action) =>
  ended.value
    ? '作战已结束'
    : action.key === 'submit' && failedChecks.value.length
      ? `未满足${failedChecks.value.map((item) => `「${item.name}」`).join('')}，暂不可提交`
      : action.shortcut
function run(action) {
  if (!blocked(action)) return submitCode(action)
}
function submitCode(action) {
  return act(action, { question: question.value.id, source: source.value })
}
function act(action, fields) {
  if (running.value || finished.value || (timeUp.value && action !== 'submit')) return task
  sample.value = null
  running.value = action
  task = execute(action, fields)
  return task
}
async function execute(action, fields) {
  try {
    if (action === 'sample') sampleRequest = new AbortController()
    const response = await api.operationAction(operation.value, action, fields, sampleRequest?.signal)
    if (action === 'sample') {
      if (fields.question === question.value.id && fields.source === source.value) sample.value = response
      return
    }
    apply(response)
    if (action === 'submit' && !response.submission.result.passed && !ended.value)
      message.warning('提交未通过，可以修改或换题后再试')
  } catch (error) {
    if (sampleRequest?.signal.aborted) return
    if (error.status === 409) await load()
    message.error(error.message)
  } finally {
    sampleRequest = null
    running.value = ''
  }
}
onMounted(() => {
  load()
  addEventListener('pagehide', saveDraft)
  clock = setInterval(() => (now.value = Date.now()), 250)
})
onBeforeUnmount(() => {
  clearInterval(clock)
  clock = 0
  sampleRequest?.abort()
  clearTimeout(refreshTimer)
  removeEventListener('pagehide', saveDraft)
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

    <template v-else>
      <div v-show="!adjusting" class="terminal-layout" :class="{ 'has-effects': checks.length }">
        <article class="panel brief-panel">
          <header class="panel-heading">
            <UiMenu v-slot="{ toggle }" :options="questionOptions" :disabled="ended" @select="selectQuestion">
              <UiButton kind="dark" :disabled="ended" :aria-label="`切换题目：${question.title}`" @click="toggle">
                {{ question.title }}<ChevronDown class="menu-chevron" :size="16" />
              </UiButton>
            </UiMenu>
            <span class="limits">{{ question.timeLimitMs }} ms · {{ question.memoryLimitBytes / 1048576 }} MiB</span>
          </header>
          <div :key="question.id" v-scroll-fade class="brief-content">
            <MarkdownContent :content="question.content" />
          </div>
        </article>

        <section class="panel work-panel" aria-label="代码编辑与验证">
          <header class="panel-heading">
            <h2><Code2 :size="18" />代码编辑</h2>
            <div class="editor-tools">
              <EditorSenses v-if="!ended" :masked="masked" />
              <span class="editor-language">{{ languageName }}</span>
            </div>
          </header>

          <div class="editor-frame">
            <CodeEditor
              :question="question.id"
              ref="codeEditor"
              v-model="source"
              :language="language"
              :disabled="ended ? '作战已结束，代码已锁定' : running ? '请求处理中，暂不可编辑' : ''"
              :masked="masked"
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
                ><ListChecks :size="14" /><i
                  >{{ passedCases }}/{{ result.totalCases }}</i
                ></span
              >
              <span title="最长运行时间"
                ><Clock3 :size="14" /><i>{{ result.timeMs.toFixed(1) }} ms</i></span
              >
              <span title="峰值内存"
                ><MemoryStick :size="14" /><i>{{ mib(result.memoryBytes) }} MiB</i></span
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
              <span
                >行 {{ cursor.line }}，列 {{ cursor.column }}<template v-if="cursor.selected"
                  >（已选 {{ cursor.selected }}）</template
                ></span
              >
              <span :title="`${sourceBytes} 字节 · ${codeLines} 有效行`">
                <FileText :size="14" /><template v-if="running">评测中…</template
                ><template v-else>{{ sourceBytes }} B · {{ codeLines }} L</template>
              </span>
            </div>
            <UiButton
              v-for="action in actions"
              :key="action.key"
              :kind="action.kind"
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
            <img src="/assets/risk-level.webp" alt="" />
            <span>指标总计</span>
            <strong><Digits :value="pad(points)" /></strong>
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
                    >{{ item.level }}<img src="/assets/risk-level.webp" alt=""
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
      <ContractPanel
        v-if="panelReady"
        v-show="adjusting"
        title="调整指标"
        :ids="ids"
        :language="language"
        lock-fixed
        :inert="Boolean(running) || ended"
        :aria-busy="Boolean(running)"
        :question="question"
        @change="adjust"
        @start="toggleView"
      />
    </template>

    <Teleport to="#header-status">
      <template v-if="operation">
        <button type="button" class="hud-button hud-edit" :disabled="Boolean(running) || ended" :aria-pressed="adjusting" @click="toggleView">
          <component :is="adjusting ? Code2 : SlidersHorizontal" :size="17" />{{ adjusting ? '返回作战' : '编辑指标' }}
        </button>
        <span class="hud-divider" />
        <button
          type="button"
          class="hud-button hud-contracts"
          :aria-label="`指标总计 ${points}，查看综合情报`"
          @click="intelOpen = true"
        >
          <img src="/assets/risk-level.webp" alt="" /><b>{{ points }}</b><Ellipsis :size="18" />
        </button>
        <span class="hud-clock" :class="{ urgent }" role="timer" :aria-label="`剩余作战时间 ${countdown}`"
          ><Clock3 :size="20" /><b>{{ countdown }}</b></span
        >
      </template>
    </Teleport>
    <Teleport to="#header-tools">
      <template v-if="operation">
        <UiButton kind="dark" :disabled="Boolean(running)" @click="leave"
          ><component :is="ended ? LogOut : Flag" :size="16" />{{
            ended ? '返回指标选择' : '放弃作战'
          }}</UiButton
        >
      </template>
    </Teleport>

    <IntelDialog v-if="operation" v-model:show="intelOpen" :ids="ids" />

    <GameDialog :show="fullscreenRequired" title="作战需全程全屏进行" :width="480" :closable="false">
      <p>退出全屏、切换窗口或标签页都会被记录，并随作战一同提交。</p>
      <template #actions>
        <UiButton kind="primary" @click="integrity.enter">进入全屏，继续作战</UiButton>
      </template>
    </GameDialog>

    <GameDialog v-if="operation" v-model:show="confirmOpen" title="放弃作战" :width="480">
      <p>放弃后立即结算，本场得分为 0。</p>
      <template #actions>
        <UiButton kind="dark" @click="confirmOpen = false">取消</UiButton>
        <UiButton kind="primary" @click="abandon">放弃作战</UiButton>
      </template>
    </GameDialog>

    <GameDialog v-if="operation" v-model:show="settlementOpen" title="作战结算" :width="560">
      <div class="intel-stats">
        <div><strong>{{ operation.score }}</strong><span>作战得分</span></div>
        <div><strong>{{ best }}</strong><span>最高纪录</span></div>
      </div>
      <div class="intel-list">
        <p><b>{{ question.title }}</b><span>{{ phaseLabels[operation.phase] }}</span></p>
      </div>
      <template #actions>
        <UiButton kind="dark" @click="settlementOpen = false">查看代码</UiButton>
        <UiButton kind="primary" @click="router.push('/')">返回指标选择</UiButton>
      </template>
    </GameDialog>
  </main>
</template>

<style scoped>
:global(.app-shell:has(.operation-view)) {
  min-width: 0;
}
.terminal-layout {
  margin-top: var(--space-4);
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
  min-height: 44px;
  padding: 4px 18px;
  border-bottom: 1px solid var(--line);
}
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
.hud-button {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 2px;
  background: #f3f3f1;
  color: #2a2b2e;
  font-size: 15px;
  cursor: pointer;
  box-shadow: 0 2px 8px #0006;
  transition:
    background 0.15s,
    transform 0.1s;
}
.hud-button:hover:not(:disabled) {
  background: #fff;
}
.hud-button:active:not(:disabled) {
  transform: scale(0.97);
}
.hud-button:disabled {
  opacity: 0.6;
  cursor: default;
}
.hud-edit {
  gap: 8px;
  padding: 0 16px 0 12px;
}
.hud-divider {
  width: 2px;
  height: 22px;
  margin: 0 12px;
  background: #ffffff8c;
}
.hud-contracts {
  gap: 8px;
  padding: 0 8px 0 10px;
  font-size: 18px;
}
.hud-contracts img {
  width: 20px;
  height: 22px;
  filter: brightness(0);
}
.hud-contracts b {
  min-width: 21px;
  font-weight: 500;
}
.hud-contracts svg {
  margin-left: 2px;
  color: #8b8c90;
}
.hud-clock {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: 18px;
  font-size: 20px;
  color: var(--text);
  transition: color 0.2s;
}
.hud-clock b {
  font-weight: 500;
}
.hud-clock.urgent {
  color: #ff4d6a;
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
  gap: 16px;
}
.editor-language {
  font-size: 14px;
  color: var(--muted);
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
  font-size: 16px;
  font-weight: 500;
  color: #ff6f86;
}
.accepted .result-summary > strong {
  color: var(--green);
}
.result-summary strong small {
  font-size: 12px;
  font-weight: 400;
  color: var(--muted);
}
.result-summary small {
  color: var(--muted);
}
.result-chevron {
  margin-left: auto;
  transition: transform 0.15s;
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
  font-size: 13px;
  line-height: 1.5;
  color: var(--soft);
  text-align: left;
}
.result-details th {
  font-size: 12px;
  font-weight: 400;
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
  justify-content: flex-end;
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
  height: 44px;
  padding: 0 2px 0 calc(var(--tuck) + 14px);
}
.effects-score img {
  width: 30px;
  height: 32px;
  opacity: 0.8;
}
.effects-score > span {
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
