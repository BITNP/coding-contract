<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NCheckbox, NSpin } from 'naive-ui'
import {
  AppWindow,
  ClipboardPaste,
  Code2,
  EyeOff,
  History,
  LogIn,
  Minimize,
  Radar,
  Bug,
  RotateCw,
  ShieldAlert,
} from 'lucide-vue-next'
import { api } from '../api.js'
import { submitGraceMs } from '../../shared/contracts.js'
import { languageById } from '../../shared/languages.js'
import UiButton from '../components/UiButton.vue'

const flagKinds = [
  { type: 'fullscreen-exit', label: '退出全屏', icon: Minimize },
  { type: 'hidden', label: '切到后台', icon: EyeOff },
  { type: 'blur', label: '窗口失焦', icon: AppWindow },
  { type: 'paste', label: '粘贴', icon: ClipboardPaste },
  { type: 'devtools', label: '开发者工具', icon: Bug },
]
const flagTypes = new Set(flagKinds.map((kind) => kind.type))
const eventLabels = {
  open: '打开页面',
  leave: '离开页面',
  'fullscreen-enter': '进入全屏',
  'fullscreen-exit': '退出全屏',
  hidden: '切到后台',
  visible: '回到前台',
  blur: '窗口失焦',
  focus: '窗口聚焦',
  devtools: '尝试打开开发者工具',
}

const operations = ref([])
const selectedId = ref('')
const detail = ref(null)
const all = ref(false)
const loaded = ref(false)
const error = ref(null)
const codeView = ref('live')
const offset = ref(0)
const now = ref(Date.now())
let sequence = 0
let poll = 0
let tick = 0

const current = computed(() => now.value + offset.value)
const denied = computed(() => [401, 403].includes(error.value?.status))
const pad = (value) => String(value).padStart(2, '0')
const clock = (time) => new Date(time).toLocaleTimeString('zh-CN', { hour12: false })
const languageName = (id) => languageById[id]?.name || id

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
function remaining({ deadline }) {
  if (!deadline) return { text: '—' }
  const left = Date.parse(deadline) - current.value
  if (left <= 0) return { text: left > -submitGraceMs ? '宽限中' : '已结束', state: 'ended' }
  const total = Math.ceil(left / 1000)
  return { text: `${pad(Math.floor(total / 60))}:${pad(total % 60)}`, state: left < 300_000 && 'urgent' }
}
function describe({ type, detail }) {
  if (type === 'paste') return `粘贴 ${detail ?? 0} 字`
  const label = eventLabels[type] || type
  return detail && (type === 'visible' || type === 'focus') ? `${label}（离开 ${seconds(detail)}）` : label
}

const rows = computed(() => operations.value.map((item) => ({ ...item, left: remaining(item) })))
const onlineCount = computed(() => operations.value.filter((item) => item.online).length)
const events = computed(() => [...(detail.value?.events || [])].reverse())
const code = computed(() => {
  const submission = detail.value?.submission
  if (codeView.value === 'submitted' && submission?.source != null)
    return { source: submission.source, language: submission.language, at: submission.submittedAt }
  return detail.value?.live
})

async function load() {
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
  }
}
function select(item) {
  if (item.id === selectedId.value) return
  selectedId.value = item.id
  detail.value = item
  codeView.value = 'live'
  load()
}
watch(all, load)
onMounted(() => {
  load()
  poll = setInterval(load, 5000)
  tick = setInterval(() => (now.value = Date.now()), 1000)
})
onBeforeUnmount(() => {
  clearInterval(poll)
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
            <span>共 <b class="num">{{ operations.length }}</b></span>
            <span>在线 <b class="num">{{ onlineCount }}</b></span>
            <NCheckbox v-model:checked="all">含 24 小时内已结束</NCheckbox>
          </div>
        </header>
        <div v-scroll-fade class="table-scroll">
          <table class="ops-table">
            <thead>
              <tr>
                <th>选手</th>
                <th>剩余</th>
                <th>题目 / 语言</th>
                <th>指标</th>
                <th>分值</th>
                <th>异常</th>
                <th>离开</th>
                <th>最后活动</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in rows"
                :key="item.id"
                :class="{ selected: item.id === selectedId, ended: !item.running }"
                tabindex="0"
                @click="select(item)"
                @keydown.enter="select(item)"
              >
                <td>
                  <div class="player">
                    <span class="avatar"
                      ><img v-if="item.user.avatar" :src="item.user.avatar" alt="" /><template v-else>{{
                        item.user.name.slice(0, 1)
                      }}</template
                      ><i :class="{ online: item.online }" :title="item.online ? '在线' : '离线'"
                    /></span>
                    <b>{{ item.user.name }}</b>
                  </div>
                </td>
                <td class="num countdown" :class="item.left.state">{{ item.left.text }}</td>
                <td>
                  <div class="title">{{ item.question }}</div>
                  <small>{{ languageName(item.language) }}</small>
                </td>
                <td>
                  <div class="chips">
                    <span v-for="contract in item.contracts" :key="contract.id">{{ contract.name }}</span>
                    <small v-if="!item.contracts.length">无</small>
                  </div>
                </td>
                <td class="num">
                  {{ item.score }}
                  <small
                    v-if="item.submission"
                    class="verdict"
                    :class="{ accepted: item.submission.verdict === 'AC' }"
                    >{{ item.submission.verdict }} {{ item.submission.score }}</small
                  >
                </td>
                <td>
                  <div class="flags">
                    <span
                      v-for="kind in flagKinds"
                      :key="kind.type"
                      :class="{ hot: item.flags[kind.type] > 0 }"
                      :title="kind.label"
                      ><component :is="kind.icon" :size="13" /><i class="num">{{
                        item.flags[kind.type]
                      }}</i></span
                    >
                  </div>
                </td>
                <td class="num" :class="{ hot: item.awayMs >= 1000 }">
                  {{ item.awayMs >= 1000 ? seconds(item.awayMs) : '—' }}
                </td>
                <td class="num seen">{{ ago(item.seenAt) }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="!rows.length" class="empty">{{ all ? '24 小时内没有作战记录' : '暂无进行中的作战' }}</p>
        </div>
      </section>

      <section class="panel detail-panel" aria-label="作战详情">
        <template v-if="detail">
          <header class="panel-heading">
            <h2>
              <span class="avatar"
                ><img v-if="detail.user.avatar" :src="detail.user.avatar" alt="" /><template v-else>{{
                  detail.user.name.slice(0, 1)
                }}</template
                ><i :class="{ online: detail.online }"
              /></span>
              {{ detail.user.name }}
            </h2>
            <small class="num user-id">{{ detail.user.id }}</small>
          </header>
          <dl class="facts">
            <div>
              <dt>开始</dt>
              <dd class="num">{{ clock(Date.parse(detail.createdAt)) }}</dd>
            </div>
            <div>
              <dt>剩余</dt>
              <dd class="num countdown" :class="remaining(detail).state">{{ remaining(detail).text }}</dd>
            </div>
            <div>
              <dt>指标分值</dt>
              <dd class="num">{{ detail.score }}</dd>
            </div>
            <div>
              <dt>提交</dt>
              <dd
                v-if="detail.submission"
                class="num verdict"
                :class="{ accepted: detail.submission.verdict === 'AC' }"
              >
                {{ detail.submission.verdict }} {{ detail.submission.score }}/{{ detail.submission.maxScore }}
              </dd>
              <dd v-else>未提交</dd>
            </div>
            <div>
              <dt>离开总计</dt>
              <dd class="num" :class="{ hot: detail.awayMs >= 1000 }">{{ seconds(detail.awayMs) }}</dd>
            </div>
          </dl>
          <div class="detail-body">
            <section class="timeline">
              <h3><History :size="15" />行为记录<small class="num">{{ events.length }}</small></h3>
              <NSpin v-if="!detail.events" size="small" />
              <ol v-else-if="events.length" v-scroll-fade>
                <li v-for="(event, index) in events" :key="index" :class="{ hot: flagTypes.has(event.type) }">
                  <time class="num" :title="`服务器接收：${clock(event.receivedAt)}`">{{
                    clock(event.at)
                  }}</time>
                  <span>{{ describe(event) }}</span>
                </li>
              </ol>
              <p v-else class="empty">暂无记录</p>
            </section>
            <section class="code">
              <h3>
                <Code2 :size="15" />
                <button :class="{ active: codeView === 'live' }" @click="codeView = 'live'">实时代码</button>
                <button
                  v-if="detail.submission?.source != null"
                  :class="{ active: codeView === 'submitted' }"
                  @click="codeView = 'submitted'"
                >
                  提交代码
                </button>
                <small v-if="code"
                  >{{ languageName(code.language) }} · <span class="num">{{ ago(code.at) }}</span></small
                >
              </h3>
              <pre v-if="code">{{ code.source }}</pre>
              <p v-else class="empty">尚未收到代码快照</p>
            </section>
          </div>
        </template>
        <p v-else class="empty">选择一场作战，查看行为记录与实时代码</p>
      </section>
    </div>
  </main>
</template>

<style scoped>
.admin-view {
  padding-top: var(--space-4);
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
  color: var(--orange);
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
  font-weight: 400;
  color: var(--text);
}
.stale {
  color: #ff718a;
}
.user-id {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--muted);
}
.empty {
  padding: 32px 18px;
  text-align: center;
  font-size: 13px;
  color: var(--muted);
}

.table-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.ops-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  color: var(--soft);
  text-align: left;
}
.ops-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 10px 10px 8px;
  background: var(--surface);
  font-size: 12px;
  font-weight: 400;
  color: var(--muted);
  white-space: nowrap;
}
.ops-table td {
  padding: 9px 10px;
  border-top: 1px solid #ffffff0a;
  vertical-align: middle;
}
.ops-table th:first-child,
.ops-table td:first-child {
  padding-left: 18px;
}
.ops-table tbody tr {
  cursor: pointer;
  transition: background 0.12s;
}
.ops-table tbody tr:hover {
  background: #ffffff08;
}
.ops-table tbody tr.selected {
  background: linear-gradient(90deg, #ff640c1f, transparent 80%);
  box-shadow: inset 2px 0 var(--orange);
}
.ops-table tbody tr.ended {
  opacity: 0.55;
}
.ops-table small {
  font-size: 12px;
  color: var(--muted);
}
.ops-table td.num {
  font-size: 15px;
  white-space: nowrap;
}
.ops-table .seen {
  font-size: 13px;
  color: var(--muted);
}
.player {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 120px;
}
.player b {
  font-weight: 500;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 160px;
}
.avatar {
  flex: none;
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--raised);
  font-size: 13px;
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
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 2px solid var(--surface);
  background: #5f6067;
}
.avatar i.online {
  background: var(--green);
  box-shadow: 0 0 6px var(--green);
}
.title {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-width: 220px;
}
.chips span {
  padding: 1px 6px;
  border-radius: 2px;
  background: #ffffff0f;
  font-size: 12px;
  white-space: nowrap;
}
.countdown.urgent {
  color: #ff4d6a;
}
.countdown.ended {
  color: var(--muted);
}
.verdict {
  margin-left: 6px;
  color: #ff6f86;
}
.verdict.accepted {
  color: var(--green);
}
.flags {
  display: flex;
  gap: 10px;
}
.flags span {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: #6c6e73;
}
.flags i {
  font-style: normal;
  font-size: 14px;
}
.flags .hot,
td.hot,
dd.hot,
.timeline li.hot {
  color: #ff4d6a;
}

.facts {
  flex: none;
  display: grid;
  grid-template-columns: repeat(5, auto);
  gap: 12px;
  margin: 0;
  padding: 14px 18px;
  border-bottom: 1px solid var(--line);
}
.facts dt {
  font-size: 12px;
  color: var(--muted);
}
.facts dd {
  margin: 2px 0 0;
  font-size: 16px;
  color: var(--text);
  white-space: nowrap;
}
.detail-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(120px, 0.8fr) minmax(0, 1.2fr);
  grid-template-columns: minmax(0, 1fr);
}
.timeline,
.code {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.timeline {
  border-bottom: 1px solid var(--line);
}
.detail-body h3 {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--soft);
}
.detail-body h3 svg {
  color: var(--muted);
}
.detail-body h3 small {
  margin-left: auto;
  font-size: 12px;
  font-weight: 400;
  color: var(--muted);
}
.timeline ol {
  flex: 1;
  min-height: 0;
  overflow: auto;
  margin: 0;
  padding: 0 18px 10px;
  list-style: none;
}
.timeline li {
  display: flex;
  gap: 14px;
  padding: 3px 0;
  font-size: 13px;
  color: var(--soft);
}
.timeline time {
  flex: none;
  color: var(--muted);
}
.timeline li.hot time {
  color: inherit;
}
.timeline .n-spin-body {
  margin: 16px auto;
}
.code h3 button {
  padding: 2px 10px;
  border: 0;
  border-radius: 11px;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
}
.code h3 button.active {
  background: var(--light);
  color: #2a2b2e;
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
}
</style>
