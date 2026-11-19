<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NCheckbox, NSpin } from 'naive-ui'
import {
  AppWindow,
  Bug,
  CalendarClock,
  ClipboardPaste,
  Clock3,
  Code2,
  EyeOff,
  FileText,
  History,
  Hourglass,
  LayoutDashboard,
  LogIn,
  Minimize,
  Radar,
  Flag,
  RotateCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trophy,
} from 'lucide-vue-next'
import { api } from '../api.js'
import { pointsOf, submitGraceMs } from '../../shared/contracts.js'
import { activityLabels, flaggedActivity, phaseLabels } from '../../shared/labels.js'
import { languageById } from '../../shared/languages.js'
import UiButton from '../components/UiButton.vue'
import InfoPopover from '../components/InfoPopover.vue'
import IndicatorStrip from '../components/IndicatorStrip.vue'

const flagIcons = {
  'fullscreen-exit': Minimize,
  hidden: EyeOff,
  blur: AppWindow,
  paste: ClipboardPaste,
  devtools: Bug,
}
const flagKinds = flaggedActivity.map((type) => ({ type, label: activityLabels[type], icon: flagIcons[type] }))

const operations = ref([])
const selectedId = ref('')
const detail = ref(null)
const all = ref(false)
const loaded = ref(false)
const error = ref(null)
const codeView = ref('live')
const tab = ref('overview')
const tabs = [
  { key: 'overview', label: '总览', icon: LayoutDashboard },
  { key: 'log', label: '日志', icon: History },
  { key: 'code', label: '代码', icon: Code2 },
]
const offset = ref(0)
const now = ref(Date.now())
let sequence = 0
let poll = 0
let tick = 0

const current = computed(() => now.value + offset.value)
const denied = computed(() => [401, 403].includes(error.value?.status))
const pad = (value) => String(value).padStart(2, '0')
const clock = new Intl.DateTimeFormat('zh-CN', {
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
}).format
const languageName = (id) => languageById[id].name

function seconds(ms) {
  const total = Math.round(ms / 1000)
  return total < 60 ? `${total} 秒` : `${Math.floor(total / 60)} 分 ${total % 60} 秒`
}
function ago(iso) {
  if (!iso) return '—'
  const total = Math.max(0, Math.round((current.value - Date.parse(iso)) / 1000))
  if (total < 60) return `${total} 秒前`
  return total < 3600 ? `${Math.floor(total / 60)} 分钟前` : `${Math.floor(total / 3600)} 小时前`
}
function remaining({ deadline, running }) {
  if (!running) return { text: '已结束', state: 'ended' }
  const left = Date.parse(deadline) - current.value
  if (left <= 0) return { text: left > -submitGraceMs ? '宽限中' : '已结束', state: 'ended' }
  const total = Math.ceil(left / 1000)
  return { text: `${pad(Math.floor(total / 60))}:${pad(total % 60)}`, state: left < 300_000 && 'urgent' }
}
function describe({ type, detail }) {
  if (type === 'paste') return `粘贴 ${detail} 字`
  const label = activityLabels[type]
  return detail && (type === 'visible' || type === 'focus') ? `${label}（离开 ${seconds(detail)}）` : label
}
function decorate(item) {
  return {
    ...item,
    left: remaining(item),
    alerts: flagKinds.filter((kind) => item.flags[kind.type] > 0),
    away: item.awayMs >= 1000,
  }
}

const rows = computed(() => operations.value.map(decorate))
const view = computed(() => detail.value && decorate(detail.value))
const onlineCount = computed(() => operations.value.filter((item) => item.online).length)
const events = computed(() =>
  (detail.value?.events || [])
    .map((event) => ({
      at: clock(event.at),
      receivedAt: clock(event.receivedAt),
      text: describe(event),
      icon: flagIcons[event.type],
    }))
    .reverse(),
)
const code = computed(() => {
  const submission = detail.value?.submission
  if (codeView.value === 'submitted' && submission?.source != null)
    return { ...submission, at: submission.submittedAt }
  return detail.value?.live
})

function schedulePoll() {
  poll = setTimeout(() => (document.hidden ? schedulePoll() : load()), 5000)
}
async function load() {
  clearTimeout(poll)
  const request = ++sequence
  const id = selectedId.value
  try {
    const [list, item] = await Promise.all([api.adminOperations(all.value), id && api.adminOperation(id)])
    if (request !== sequence) return
    offset.value = list.serverTime - Date.now()
    operations.value = list.operations
    if (item && id === selectedId.value) detail.value = item
    error.value = null
    loaded.value = true
  } catch (e) {
    if (request === sequence) error.value = e
  } finally {
    if (request === sequence) schedulePoll()
  }
}
function select(item) {
  if (item.id === selectedId.value) return
  selectedId.value = item.id
  detail.value = operations.value.find((operation) => operation.id === item.id)
  codeView.value = 'live'
  load()
}
watch(all, load)
onMounted(() => {
  load()
  tick = setInterval(() => (now.value = Date.now()), 1000)
})
onBeforeUnmount(() => {
  sequence++
  clearTimeout(poll)
  clearInterval(tick)
})
</script>

<template>
  <main class="admin-view">
    <div v-if="!loaded && denied" class="admin-state">
      <ShieldAlert :size="34" />
      <h2>{{ error.status === 401 ? '需要登录' : '需要管理员权限' }}</h2>
      <p>
        {{
          error.status === 401
            ? '管理台仅对管理员开放，请先使用网协统一账号登录。'
            : '当前账号不在管理员名单中，无法查看作战监控。'
        }}
      </p>
      <UiButton v-if="error.status === 401" kind="primary" @click="api.login('/admin')"
        ><LogIn :size="16" />统一登录</UiButton
      >
    </div>
    <div v-else-if="!loaded && error" class="admin-state">
      <p>{{ error.message }}</p>
      <UiButton kind="primary" @click="load"><RotateCw :size="16" />重新连接</UiButton>
    </div>
    <div v-else-if="!loaded" class="admin-state">
      <NSpin size="large" />
      <p>正在接入作战监控…</p>
    </div>

    <div v-else class="admin-layout">
      <section class="panel list-panel" aria-label="进行中的作战">
        <header class="panel-heading">
          <h1><Radar :size="18" />作战监控</h1>
          <div class="heading-meta">
            <span v-if="error" class="stale">{{ error.message }}</span>
            <span>共 <b>{{ operations.length }}</b></span>
            <span>在线 <b>{{ onlineCount }}</b></span>
            <NCheckbox v-model:checked="all">含 24 小时内已结束</NCheckbox>
          </div>
        </header>
        <ul v-if="rows.length" v-scroll-fade class="op-list">
          <li
            v-for="item in rows"
            :key="item.id"
            class="op-card"
            :class="{ selected: item.id === selectedId, ended: !item.running }"
            tabindex="0"
            @click="select(item)"
            @keydown.enter="select(item)"
          >
            <div class="player">
              <span class="avatar"
                ><img v-if="item.user.avatar" :src="item.user.avatar" alt="" /><template v-else>{{
                  item.user.name.slice(0, 1)
                }}</template
                ><i :class="{ online: item.online }"
              /></span>
              <div class="stack">
                <b>{{ item.user.name }}</b>
                <small>{{ languageName(item.language) }} · {{ item.online ? '在线' : ago(item.seenAt) }}</small>
              </div>
            </div>

            <div class="stack">
              <b>{{ item.question || '—' }}</b>
              <small>{{ phaseLabels[item.phase] }}</small>
            </div>

            <IndicatorStrip :ids="item.contracts" />

            <InfoPopover title="异常行为" placement="bottom-end" :width="240">
              <template #trigger>
                <div class="alerts">
                  <span v-for="kind in item.alerts" :key="kind.type"
                    ><component :is="kind.icon" :size="15" />{{ item.flags[kind.type] }}</span
                  >
                  <span v-if="item.away"><Hourglass :size="15" />{{ Math.round(item.awayMs / 1000) }}s</span>
                  <ShieldCheck v-if="!item.alerts.length && !item.away" class="clear" :size="18" />
                </div>
              </template>
              <ul class="flag-list">
                <li v-for="kind in flagKinds" :key="kind.type" :class="{ hot: item.flags[kind.type] > 0 }">
                  <component :is="kind.icon" :size="14" />{{ kind.label }}<b>{{ item.flags[kind.type] }}</b>
                </li>
                <li :class="{ hot: item.away }"><Hourglass :size="14" />离开总计<b>{{ seconds(item.awayMs) }}</b></li>
              </ul>
            </InfoPopover>

            <div class="clock" :class="item.left.state"><Clock3 :size="15" />{{ item.left.text }}</div>

            <div class="score">
              <strong><span class="num">{{ item.score }}</span><img src="/assets/risk-level.webp" alt="分" /></strong>
              <small v-if="item.submission" :class="{ accepted: item.submission.verdict === 'AC' }"
                >最近 {{ item.submission.verdict }}</small
              >
            </div>
          </li>
        </ul>
        <p v-else class="empty">{{ all ? '24 小时内没有作战记录' : '暂无进行中的作战' }}</p>
      </section>

      <section class="panel detail-panel" aria-label="作战详情">
        <template v-if="view">
          <header class="detail-head">
            <span class="avatar"
              ><img v-if="view.user.avatar" :src="view.user.avatar" alt="" /><template v-else>{{
                view.user.name.slice(0, 1)
              }}</template
              ><i :class="{ online: view.online }"
            /></span>
            <div class="stack">
              <h2>{{ view.user.name }}</h2>
              <small>{{ view.user.id }}</small>
            </div>
            <div class="detail-clock" :class="view.left.state">
              <b>{{ view.left.text }}</b><small>{{ view.online ? '在线' : `离线 · ${ago(view.seenAt)}` }}</small>
            </div>
          </header>
          <nav class="detail-tabs">
            <button v-for="item in tabs" :key="item.key" :class="{ active: tab === item.key }" @click="tab = item.key">
              <component :is="item.icon" :size="15" />{{ item.label
              }}<small v-if="item.key === 'log' && detail.events">{{ events.length }}</small>
            </button>
          </nav>

          <div v-if="tab === 'overview'" v-scroll-fade class="overview">
            <ul class="facts">
              <li><CalendarClock :size="15" />开始时间<b>{{ clock(Date.parse(view.createdAt)) }}</b></li>
              <li><Code2 :size="15" />语言<b>{{ languageName(view.language) }}</b></li>
              <li><FileText :size="15" />题目<b>{{ view.question || '—' }}</b></li>
              <li><Flag :size="15" />状态<b>{{ phaseLabels[view.phase] }}</b></li>
              <li><Trophy :size="15" />作战得分<b class="num">{{ view.score }}</b></li>
              <li :class="view.submission && (view.submission.verdict === 'AC' ? 'accepted' : 'hot')">
                <Send :size="15" />最近提交<b>{{
                  view.submission
                    ? `${view.submission.question} · ${view.submission.verdict}`
                    : '未提交'
                }}</b>
              </li>
            </ul>
            <h3>已选指标 · {{ pointsOf(view.contracts) }} 分</h3>
            <IndicatorStrip :ids="view.contracts" placement="left" />
            <h3>异常行为</h3>
            <ul class="facts">
              <li v-for="kind in flagKinds" :key="kind.type" :class="{ hot: view.flags[kind.type] > 0 }">
                <component :is="kind.icon" :size="15" />{{ kind.label }}<b>{{ view.flags[kind.type] }}</b>
              </li>
              <li :class="{ hot: view.away }"><Hourglass :size="15" />离开总计<b>{{ seconds(view.awayMs) }}</b></li>
            </ul>
          </div>

          <section v-else-if="tab === 'log'" class="timeline">
            <NSpin v-if="!detail.events" size="small" />
            <ol v-else-if="events.length" v-scroll-fade>
              <li v-for="(event, index) in events" :key="index" :class="{ hot: event.icon }">
                <component :is="event.icon" v-if="event.icon" :size="13" /><i v-else />
                <time :title="`服务器接收：${event.receivedAt}`">{{ event.at }}</time>
                <span>{{ event.text }}</span>
              </li>
            </ol>
            <p v-else class="empty">暂无记录</p>
          </section>

          <section v-else class="code">
            <div class="code-bar">
              <button :class="{ active: codeView === 'live' }" @click="codeView = 'live'">实时代码</button>
              <button
                v-if="detail.submission?.source != null"
                :class="{ active: codeView === 'submitted' }"
                @click="codeView = 'submitted'"
              >
                提交代码
              </button>
              <small v-if="code">{{ code.question }} · {{ languageName(code.language) }} · {{ ago(code.at) }}</small>
            </div>
            <pre v-if="code">{{ code.source }}</pre>
            <NSpin v-else-if="!detail.events" size="small" />
            <p v-else class="empty">尚未收到代码快照</p>
          </section>
        </template>
        <p v-else class="empty">选择一场作战，查看总览、日志与实时代码</p>
      </section>
    </div>
  </main>
</template>

<style scoped>
:global(.app-shell:has(.admin-view)) {
  min-width: 0;
}
.admin-view {
  padding-top: var(--space-4);
  user-select: text;
}
.admin-state {
  min-height: 70vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  font-size: 15px;
  color: var(--muted);
  text-align: center;
}
.admin-state > svg {
  color: var(--red);
}
.admin-state h2 {
  font-size: 24px;
  font-weight: 500;
  color: var(--text);
}
.admin-state p {
  margin-bottom: 8px;
}
.admin-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) clamp(380px, 34vw, 600px);
  gap: var(--space-3);
  height: calc(100dvh - var(--header-height) - var(--page-bottom) - var(--space-4) - 8px);
  min-height: 460px;
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
.list-panel {
  border-top: 2px solid var(--orange);
}
.detail-panel {
  border-top: 2px solid #5d5e60;
}
.panel-heading {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: 52px;
  padding: 8px 18px;
  border-bottom: 1px solid var(--line);
}
.panel-heading h1 {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 500;
  letter-spacing: 0.02em;
}
.panel-heading h1 svg {
  color: var(--muted);
}
.heading-meta {
  display: flex;
  align-items: center;
  gap: 18px;
  font-size: 13px;
  color: var(--muted);
  white-space: nowrap;
}
.heading-meta b {
  font-size: 16px;
  font-weight: 500;
  color: var(--text);
}
.stale {
  color: #ff718a;
}
.empty {
  padding: 32px 18px;
  text-align: center;
  font-size: 13px;
  color: var(--muted);
}
.stack {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.stack > * {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stack small {
  font-size: 12px;
  color: var(--muted);
}

.avatar {
  flex: none;
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(140deg, #4a4b50, #2a2b2f);
  font-size: 15px;
  color: var(--text);
}
.avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
.avatar i {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--surface);
  background: #5f6067;
}
.avatar i.online {
  background: var(--green);
  box-shadow: 0 0 6px var(--green);
}

.op-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  margin: 0;
  padding: 10px 12px;
  list-style: none;
  display: grid;
  grid-template-columns: minmax(170px, 1fr) auto minmax(96px, 1fr) auto auto auto;
  align-content: start;
  gap: 6px 22px;
}
.op-card {
  position: relative;
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: subgrid;
  align-items: center;
  min-height: 62px;
  padding: 8px 16px 8px 14px;
  border-left: 3px solid transparent;
  background: linear-gradient(135deg, #2a2b2e, #232427);
  cursor: pointer;
  outline: none;
  transition:
    background 0.12s,
    border-color 0.12s;
}
.op-card::after {
  content: '';
  position: absolute;
  inset: 0 0 0 auto;
  width: 44px;
  pointer-events: none;
  opacity: 0.035;
  background: repeating-linear-gradient(135deg, transparent 0 15px, white 15px 26px);
}
.op-card:hover,
.op-card:focus-visible {
  background: linear-gradient(135deg, #313236, #29292d);
}
.op-card.selected {
  border-left-color: var(--red);
  background: linear-gradient(90deg, #e5003224, #26272a 70%);
}
.op-card.ended {
  opacity: 0.55;
}
.player {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}
.player b {
  font-size: 15px;
  font-weight: 500;
  color: var(--text);
}

.op-card .indicator-strip {
  --indicator-size: 24px;
}
.alerts {
  display: grid;
  grid-template-rows: repeat(2, auto);
  grid-auto-flow: column;
  align-content: center;
  gap: 4px 10px;
  min-width: 24px;
  cursor: help;
  font-size: 13px;
  font-weight: 500;
  color: #ff4d6a;
}
.alerts span {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.alerts .clear {
  grid-row: 1 / -1;
  color: #5f6166;
}
.flag-list {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.flag-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
}
.flag-list b {
  margin-left: auto;
  font-weight: 500;
}
.flag-list .hot {
  color: #ff4d6a;
}

.clock {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
}
.clock svg {
  color: var(--muted);
}
.clock.urgent,
.detail-clock.urgent b {
  color: #ff4d6a;
}
.clock.ended {
  font-weight: 400;
  color: var(--muted);
}
.score {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.score strong {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 26px;
  font-weight: 400;
  line-height: 1;
  color: var(--text);
}
.score strong img {
  width: 15px;
  height: 16px;
  opacity: 0.8;
}
.score small {
  margin-top: 3px;
  font-size: 11px;
  color: #ff6f86;
  white-space: nowrap;
}
.score small.accepted {
  color: var(--green);
}

.detail-head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 18px;
}
.detail-head h2 {
  font-size: 17px;
  font-weight: 500;
  line-height: 1.3;
}
.detail-clock {
  margin-left: auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  white-space: nowrap;
}
.detail-clock b {
  font-size: 20px;
  font-weight: 500;
  line-height: 1.15;
}
.detail-clock.ended b {
  color: var(--muted);
}
.detail-clock small {
  font-size: 12px;
  color: var(--muted);
}
.detail-tabs {
  flex: none;
  display: flex;
  gap: 4px;
  padding: 0 10px;
  border-bottom: 1px solid var(--line);
}
.detail-tabs button {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 12px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--muted);
  font-size: 14px;
  cursor: pointer;
  transition:
    color 0.12s,
    border-color 0.12s;
}
.detail-tabs button:hover {
  color: var(--soft);
}
.detail-tabs button.active {
  border-bottom-color: var(--red);
  color: var(--text);
}
.detail-tabs small {
  font-size: 12px;
  color: var(--muted);
}

.overview {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px 18px 16px;
}
.overview h3 {
  margin: 16px 0 6px;
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0.08em;
  color: var(--muted);
}
.facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.facts li {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 34px;
  padding: 0 12px;
  background: #ffffff08;
  font-size: 13px;
  color: var(--muted);
  white-space: nowrap;
}
.facts b {
  margin-left: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
}
.facts b.num {
  font-size: 18px;
  font-weight: 400;
}
.facts .accepted b {
  color: var(--green);
}
.facts .hot,
.facts .hot b {
  color: #ff6f86;
}
.timeline,
.code {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.timeline ol {
  flex: 1;
  min-height: 0;
  overflow: auto;
  margin: 0;
  padding: 10px 18px;
  list-style: none;
}
.timeline li {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 26px;
  font-size: 13px;
  color: var(--soft);
}
.timeline li > i {
  flex: none;
  width: 13px;
  height: 5px;
  background: radial-gradient(circle, #5f6166 2px, transparent 2.5px);
}
.timeline time {
  flex: none;
  font-size: 12px;
  color: var(--muted);
}
.timeline li.hot,
.timeline li.hot time {
  color: #ff4d6a;
}
.timeline .n-spin-body,
.code .n-spin-body {
  margin: 24px auto;
}
.code-bar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px 8px;
}
.code-bar button {
  padding: 2px 10px;
  border: 0;
  border-radius: 11px;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
}
.code-bar button.active {
  background: var(--light);
  color: #2a2b2e;
}
.code-bar small {
  margin-left: auto;
  font-size: 12px;
  color: var(--muted);
}
.code pre {
  flex: 1;
  min-height: 0;
  overflow: auto;
  margin: 0 12px 12px;
  padding: 12px 14px;
  border-radius: 3px;
  background: #141517;
  font: 12.5px/1.6 var(--mono);
  color: var(--soft);
  tab-size: 4;
  user-select: text;
}

@media (max-width: 1280px) {
  .op-list {
    column-gap: 14px;
  }
}
@media (max-width: 1000px) {
  .admin-layout {
    height: auto;
    grid-template-columns: minmax(0, 1fr);
  }
  .op-list {
    max-height: 50dvh;
  }
  .detail-panel {
    min-height: 24rem;
  }
}
@media (max-width: 640px) {
  .op-list {
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 6px 10px;
  }
  .op-card {
    row-gap: 6px;
  }
  .op-card .indicator-strip {
    grid-column: 1;
    grid-row: 2;
  }
  .op-card .score {
    grid-column: 3;
    grid-row: 1;
  }
  .panel-heading, .heading-meta {
    flex-wrap: wrap;
  }
  .facts {
    grid-template-columns: 1fr;
  }
}
</style>
