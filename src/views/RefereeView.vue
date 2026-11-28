<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NSpin, useMessage } from 'naive-ui'
import {
  Check,
  Clock3,
  Code2,
  Flag,
  Gavel,
  Hourglass,
  LogIn,
  QrCode,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  UserRoundCheck,
  X,
} from 'lucide-vue-next'
import { api } from '../api.js'
import { activityLabels, flaggedActivity, phaseLabels } from '../../shared/labels.js'
import { languageById } from '../../shared/languages.js'
import UiButton from '../components/UiButton.vue'
import IndicatorStrip from '../components/IndicatorStrip.vue'
import GameDialog from '../components/GameDialog.vue'
import { user } from '../state.js'

const message = useMessage()
const operations = ref([])
const selectedId = ref('')
const detail = ref(null)
const loaded = ref(false)
const error = ref(null)
const busy = ref('')
const tab = ref('pair')
const codeView = ref('live')
const confirmAction = ref(null)
const offset = ref(0)
const now = ref(Date.now())
let sequence = 0
let poll = 0
let tick = 0

const tabs = [
  { key: 'pair', label: '待配对' },
  { key: 'live', label: '监督中' },
  { key: 'review', label: '待确认' },
  { key: 'done', label: '已结束' },
]
const denied = computed(() => [401, 403].includes(error.value?.status))
const me = computed(() => user.value?.name || '访客')
const current = computed(() => now.value + offset.value)

// 默认只看自己接入的选手；可切到全部裁判查看全局在监作战。待配对无人接入，始终全局可见。
const scope = ref(localStorage.getItem('pioneer-referee-scope') === 'all' ? 'all' : 'mine')
const mineOnly = computed(() => scope.value === 'mine')
const groups = computed(() => {
  const visible = (item) => !mineOnly.value || item.mine
  return {
    pair: operations.value.filter((item) => !item.referee && item.phase === 'active'),
    live: operations.value.filter(
      (item) => item.referee && item.phase === 'active' && visible(item),
    ),
    review: operations.value.filter((item) => item.review?.status === 'pending' && visible(item)),
    done: operations.value.filter(
      (item) =>
        item.phase !== 'active' && item.review?.status !== 'pending' && visible(item),
    ),
  }
})
const list = computed(() => groups.value[tab.value])
const emptyText = computed(() => {
  const base =
    tab.value === 'pair'
      ? '暂无等待配对的参赛者'
      : tab.value === 'review'
        ? '没有待确认的成绩'
        : '暂无记录'
  return mineOnly.value && tab.value !== 'pair' ? `${base}（可切到「全部裁判」查看）` : base
})

const pad = (value) => String(value).padStart(2, '0')
const clock = new Intl.DateTimeFormat('zh-CN', {
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
}).format
const languageName = (id) => languageById[id].name
const flagKinds = flaggedActivity.map((type) => ({ type, label: activityLabels[type] }))

function remaining({ deadline, phase }) {
  if (phase !== 'active') return { text: '已结束', state: 'ended' }
  const left = Date.parse(deadline) - current.value
  const total = Math.ceil(Math.max(0, left) / 1000)
  return {
    text: left <= 0 ? '已到时限' : `${pad(Math.floor(total / 60))}:${pad(total % 60)}`,
    state: left <= 0 ? 'ended' : left < 300_000 ? 'urgent' : '',
  }
}
function ago(iso) {
  if (!iso) return '—'
  const total = Math.max(0, Math.round((current.value - Date.parse(iso)) / 1000))
  if (total < 60) return `${total} 秒前`
  return total < 3600 ? `${Math.floor(total / 60)} 分钟前` : `${Math.floor(total / 3600)} 小时前`
}
function seconds(ms) {
  const total = Math.round(ms / 1000)
  return total < 60 ? `${total} 秒` : `${Math.floor(total / 60)} 分 ${total % 60} 秒`
}
function badge(item) {
  if (item.review?.status === 'pending') return { text: '待核验', state: 'pending' }
  if (item.review?.status === 'confirmed') return { text: '已确认', state: 'confirmed' }
  if (item.review?.status === 'rejected') return { text: '已驳回', state: 'rejected' }
  if (item.phase === 'active')
    return item.referee ? { text: '监督中', state: 'live' } : { text: '待配对', state: 'pair' }
  if (item.phase === 'passed') return { text: '未配对 · 部分有效', state: 'partial' }
  return { text: phaseLabels[item.phase], state: 'ended' }
}

const events = computed(() =>
  (detail.value?.events || [])
    .map((event) => ({ at: clock(event.at), text: activityLabels[event.type], icon: event.type }))
    .reverse(),
)
const code = computed(() => {
  const item = detail.value
  if (!item) return null
  if (codeView.value === 'submitted' && item.submission?.source != null)
    return { ...item.submission, at: item.submission.submittedAt }
  return item.live
})
const canPair = computed(() => detail.value && !detail.value.referee && detail.value.phase === 'active')
const canReview = computed(
  () => detail.value?.review?.status === 'pending' && detail.value?.mine,
)

function schedulePoll() {
  poll = setTimeout(() => (document.hidden ? schedulePoll() : load()), 5000)
}
async function load() {
  clearTimeout(poll)
  const request = ++sequence
  try {
    const result = await api.refereeOperations()
    if (request !== sequence) return
    offset.value = result.serverTime - Date.now()
    operations.value = result.operations
    if (!operations.value.some((entry) => entry.id === selectedId.value)) {
      const next = groups.value[tab.value][0] || null
      selectedId.value = next?.id || ''
      detail.value = next
    }
    if (selectedId.value) {
      const item = await api.refereeOperation(selectedId.value).catch(() => null)
      if (request === sequence && item) detail.value = item
    }
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
  detail.value = item
  codeView.value = 'live'
  load()
}
function switchTab(key) {
  tab.value = key
  const next = groups.value[key][0] || null
  selectedId.value = next?.id || ''
  detail.value = next
}
function switchScope(value) {
  if (scope.value === value) return
  scope.value = value
  localStorage.setItem('pioneer-referee-scope', value)
  const next = groups.value[tab.value][0] || null
  selectedId.value = next?.id || ''
  detail.value = next
  load()
}
async function run(work, success) {
  if (busy.value) return
  busy.value = 'action'
  try {
    const updated = await work()
    if (updated) detail.value = updated
    message.success(success)
    await load()
  } catch (e) {
    message.error(e.message)
  } finally {
    busy.value = ''
  }
}
const pair = (item) =>
  run(() => api.refereePair(item.id), `已接入 ${item.user.name}，请现场监督`)
const review = (item, decision) => {
  confirmAction.value = null
  return run(
    () => api.refereeReview(item.id, decision),
    decision === 'confirmed' ? '已确认成绩' : '已驳回成绩',
  )
}

watch(tab, () => load())
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
  <main class="referee-view">
    <div v-if="!loaded && denied" class="referee-state">
      <ShieldAlert :size="34" />
      <h2>{{ error.status === 401 ? '需要登录' : '需要裁判权限' }}</h2>
      <p>
        {{
          error.status === 401
            ? '裁判端仅对裁判开放，请先使用网协统一账号登录。'
            : '当前账号不在裁判名单中，无法进入裁判端。'
        }}
      </p>
      <UiButton v-if="error.status === 401" kind="primary" @click="api.login('/referee')"
        ><LogIn :size="16" />统一登录</UiButton
      >
    </div>
    <div v-else-if="!loaded && error" class="referee-state">
      <p>{{ error.message }}</p>
      <UiButton kind="primary" @click="load"><RotateCw :size="16" />重新连接</UiButton>
    </div>
    <div v-else-if="!loaded" class="referee-state">
      <NSpin size="large" />
      <p>正在接入裁判席…</p>
    </div>

    <div v-else class="referee-layout">
      <section class="panel list-panel" aria-label="待核验作战">
        <header class="panel-heading">
          <h1><Gavel :size="18" />裁判席</h1>
          <div class="heading-meta">
            <span v-if="error" class="stale">{{ error.message }}</span>
            <span>当前裁判 <b>{{ me }}</b></span>
            <span>需要核验 <b>{{ operations.length }}</b></span>
            <span>待确认 <b>{{ groups.review.length }}</b></span>
          </div>
        </header>
        <nav class="tab-bar">
          <button
            v-for="item in tabs"
            :key="item.key"
            :class="{ active: tab === item.key }"
            @click="switchTab(item.key)"
          >
            {{ item.label }}<small v-if="groups[item.key].length">{{ groups[item.key].length }}</small>
          </button>
          <div class="scope-switch" role="group" aria-label="可见范围">
            <button
              type="button"
              :class="{ active: scope === 'mine' }"
              :aria-pressed="scope === 'mine'"
              @click="switchScope('mine')"
            >
              只看我的
            </button>
            <button
              type="button"
              :class="{ active: scope === 'all' }"
              :aria-pressed="scope === 'all'"
              @click="switchScope('all')"
            >
              全部裁判
            </button>
          </div>
        </nav>
        <ul v-if="list.length" v-scroll-fade class="op-list">
          <li
            v-for="item in list"
            :key="item.id"
            class="op-card"
            :class="{ selected: item.id === selectedId, ended: item.phase !== 'active' }"
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
              <small
                >{{ phaseLabels[item.phase]
                }}<template v-if="!item.referee && item.phase === 'active'"
                  > · 配对码 {{ item.pairCode }}</template
                ><template v-else-if="item.referee"
                  > · 裁判 {{ item.referee.name }}<template v-if="item.mine">（我）</template></template
                ></small
              >
            </div>
            <IndicatorStrip :ids="item.contracts" />
            <span class="badge" :class="badge(item).state">{{ badge(item).text }}</span>
            <div class="clock" :class="remaining(item).state">
              <Clock3 :size="15" />{{ remaining(item).text }}
            </div>
            <div class="score">
              <strong><span class="num">{{ item.review?.status === 'pending' ? item.selectedScore : item.score }}</span><img src="/assets/risk-level.webp" alt="分" /></strong>
              <small>所选 {{ item.points }}</small>
            </div>
          </li>
        </ul>
        <p v-else class="empty">{{ emptyText }}</p>
      </section>

      <section class="panel detail-panel" aria-label="作战详情">
        <template v-if="detail">
          <header class="detail-head">
            <span class="avatar"
              ><img v-if="detail.user.avatar" :src="detail.user.avatar" alt="" /><template v-else>{{
                detail.user.name.slice(0, 1)
              }}</template
              ><i :class="{ online: detail.online }"
            /></span>
            <div class="stack">
              <h2>{{ detail.user.name }}</h2>
              <small>{{ detail.user.id }}</small>
            </div>
            <div class="detail-clock" :class="remaining(detail).state">
              <b>{{ remaining(detail).text }}</b
              ><small>{{ detail.online ? '在线' : `离线 · ${ago(detail.seenAt)}` }}</small>
            </div>
          </header>

          <ul class="facts">
            <li><Code2 :size="15" />语言<b>{{ languageName(detail.language) }}</b></li>
            <li><Flag :size="15" />题目<b>{{ detail.question || '—' }}</b></li>
            <li><Flag :size="15" />状态<b>{{ phaseLabels[detail.phase] }}</b></li>
            <li><Trophy :size="15" />所选成绩<b class="num">{{ detail.points }}</b></li>
            <li>
              <ShieldCheck :size="15" />自动可核验<b class="num">{{ detail.automaticScore }}</b>
            </li>
            <li :class="{ hot: detail.review?.status === 'rejected', accepted: detail.review?.status === 'confirmed' }">
              <Gavel :size="15" />核验<b>{{ badge(detail).text }}</b>
            </li>
            <li v-if="detail.phase === 'active'"><QrCode :size="15" />配对码<b class="code">{{ detail.pairCode }}</b></li>
            <li v-if="detail.referee"><UserRoundCheck :size="15" />裁判<b>{{ detail.referee.name }}</b></li>
            <li v-if="detail.review?.at"><Clock3 :size="15" />核验时间<b>{{ clock(Date.parse(detail.review.at)) }}</b></li>
          </ul>

          <h3>已选指标</h3>
          <IndicatorStrip :ids="detail.contracts" placement="left" />

          <h3>异常行为</h3>
          <ul class="facts flags">
            <li v-for="kind in flagKinds" :key="kind.type" :class="{ hot: detail.flags[kind.type] > 0 }">
              {{ kind.label }}<b>{{ detail.flags[kind.type] }}</b>
            </li>
            <li :class="{ hot: detail.awayMs >= 1000 }">
              <Hourglass :size="15" />离开总计<b>{{ seconds(detail.awayMs) }}</b>
            </li>
          </ul>

          <details class="log-panel">
            <summary>行为日志 · {{ events.length }} 条</summary>
            <ol v-if="events.length">
              <li v-for="(event, index) in events" :key="index">
                <time>{{ event.at }}</time><span>{{ event.text }}</span>
              </li>
            </ol>
            <p v-else class="empty">暂无记录</p>
          </details>

          <div class="code-panel">
            <div class="code-bar">
              <button :class="{ active: codeView === 'live' }" @click="codeView = 'live'">实时代码</button>
              <button
                v-if="detail.submission?.source != null"
                :class="{ active: codeView === 'submitted' }"
                @click="codeView = 'submitted'"
              >
                提交代码
              </button>
              <small v-if="code">{{ code.question }} · {{ languageName(code.language) }}</small>
            </div>
            <pre v-if="code">{{ code.source }}</pre>
            <p v-else class="empty">尚未收到代码快照</p>
          </div>

          <footer class="detail-actions">
            <span v-if="!detail.mine && detail.referee" class="hint">由裁判 {{ detail.referee.name }} 核验</span>
            <span v-else-if="detail.review?.status === 'pending' && !detail.mine" class="hint">该成绩由其他裁判接入</span>
            <UiButton v-if="canPair" kind="primary" :disabled="Boolean(busy)" @click="pair(detail)">
              <UserRoundCheck :size="16" />接入并配对
            </UiButton>
            <template v-if="canReview">
              <UiButton kind="dark" :disabled="Boolean(busy)" @click="confirmAction = 'rejected'"
                ><X :size="16" />驳回成绩</UiButton
              >
              <UiButton kind="primary" :disabled="Boolean(busy)" @click="confirmAction = 'confirmed'"
                ><Check :size="16" />确认成绩</UiButton
              >
            </template>
            <span v-else-if="detail.review?.status === 'pending'" class="hint">请由接入的裁判确认</span>
            <span v-else-if="detail.phase === 'passed' && !detail.referee" class="hint">
              未配对：有效成绩 {{ detail.score }} / {{ detail.points }}
            </span>
          </footer>
        </template>
        <p v-else class="empty">从左侧选择一名参赛者，查看异常行为与提交代码后核验成绩</p>
      </section>
    </div>

    <GameDialog
      :show="Boolean(confirmAction)"
      :title="confirmAction === 'rejected' ? '驳回成绩' : '确认成绩'"
      :width="460"
      @update:show="(value) => !value && (confirmAction = null)"
    >
      <p v-if="confirmAction === 'rejected'">
        驳回后本次成绩按 0 分计入，不会出现在排行榜。请确认现场核验未通过。
      </p>
      <p v-else>
        确认后按所选成绩 <b>{{ detail?.points }}</b> 分计入排行榜。请确认参赛者全程遵守了线下核验条款。
      </p>
      <template #actions>
        <UiButton kind="dark" @click="confirmAction = null">取消</UiButton>
        <UiButton kind="primary" :disabled="Boolean(busy)" @click="review(detail, confirmAction)">
          {{ confirmAction === 'rejected' ? '驳回' : '确认' }}
        </UiButton>
      </template>
    </GameDialog>
  </main>
</template>

<style scoped>
:global(.app-shell:has(.referee-view)) {
  min-width: 0;
}
.referee-view {
  padding-top: var(--space-4);
  user-select: text;
}
.referee-state {
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
.referee-state > svg {
  color: #e8a33d;
}
.referee-state h2 {
  font-size: 24px;
  font-weight: 500;
  color: var(--text);
}
.referee-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) clamp(380px, 34vw, 580px);
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
  border-top: 2px solid #e8a33d;
}
.detail-panel {
  border-top: 2px solid #5d5e60;
  overflow: hidden;
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
  color: #e8a33d;
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
  font-size: 15px;
  font-weight: 500;
  color: var(--text);
}
.stale {
  color: #ff718a;
}
.tab-bar {
  flex: none;
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
}
.tab-bar button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
  border: 0;
  border-radius: 2px;
  background: transparent;
  color: var(--muted);
  font-size: 14px;
  cursor: pointer;
}
.tab-bar button:hover {
  background: #ffffff0a;
  color: var(--text);
}
.tab-bar button.active {
  background: #e8a33d1f;
  color: #f3c264;
}
.tab-bar small {
  font-size: 11px;
  color: inherit;
  opacity: 0.8;
}
.scope-switch {
  display: flex;
  gap: 2px;
  margin-left: auto;
  padding: 2px;
  border-radius: 3px;
  background: #ffffff0a;
}
.scope-switch button {
  height: 26px;
  padding: 0 10px;
  font-size: 12px;
}
.scope-switch button.active {
  background: #e8a33d2e;
  color: #f3c264;
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
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.op-card {
  position: relative;
  display: grid;
  grid-template-columns: minmax(150px, 1.1fr) minmax(90px, 0.9fr) auto auto auto auto;
  align-items: center;
  gap: 16px;
  min-height: 62px;
  padding: 8px 16px;
  border-left: 3px solid transparent;
  background: linear-gradient(135deg, #2a2b2e, #232427);
  cursor: pointer;
  outline: none;
  transition: background 0.12s, border-color 0.12s;
}
.op-card:hover,
.op-card:focus-visible {
  background: linear-gradient(135deg, #313236, #29292d);
}
.op-card.selected {
  border-left-color: #e8a33d;
  background: linear-gradient(90deg, #e8a33d1f, #26272a 70%);
}
.op-card.ended {
  opacity: 0.7;
}
.player {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}
.badge {
  padding: 2px 8px;
  border-radius: 2px;
  font-size: 12px;
  white-space: nowrap;
}
.badge.pair {
  background: #e8a33d22;
  color: #f3c264;
}
.badge.live {
  background: #7f9c5e22;
  color: #a6c47c;
}
.badge.pending {
  background: #c9a22726;
  color: #f0cf5c;
}
.badge.confirmed {
  background: #7f9c5e26;
  color: #a6c47c;
}
.badge.rejected {
  background: #e5003226;
  color: #ff718a;
}
.badge.partial,
.badge.ended {
  background: #ffffff12;
  color: var(--muted);
}
.clock {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--soft);
  white-space: nowrap;
}
.clock.urgent {
  color: #ff718a;
}
.score {
  min-width: 84px;
  text-align: right;
}
.score strong {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 20px;
  font-weight: 400;
}
.score strong img {
  width: 16px;
  height: 17px;
}
.score small {
  display: block;
  font-size: 11px;
  color: var(--muted);
}
.detail-head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--line);
}
.detail-head h2 {
  font-size: 18px;
  font-weight: 500;
}
.detail-head small {
  font-size: 12px;
  color: var(--muted);
}
.detail-clock {
  margin-left: auto;
  text-align: right;
}
.detail-clock b {
  font-size: 20px;
  font-weight: 400;
}
.detail-clock.urgent b {
  color: #ff718a;
}
.detail-clock small {
  display: block;
  font-size: 12px;
  color: var(--muted);
}
.facts {
  flex: none;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 20px;
  margin: 0;
  padding: 12px 18px;
  list-style: none;
  font-size: 13px;
  color: var(--muted);
}
.facts li {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.facts li b {
  margin-left: auto;
  font-weight: 500;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.facts li.hot b {
  color: #ff718a;
}
.facts li.accepted b {
  color: #a6c47c;
}
.facts b.code {
  font: 600 15px/1 var(--mono);
  letter-spacing: 0.14em;
  color: #f3c264;
}
.flags {
  padding-top: 0;
}
.detail-panel h3 {
  flex: none;
  padding: 4px 18px 8px;
  font-size: 13px;
  font-weight: 400;
  color: var(--muted);
}
.detail-panel > :deep(.indicator-strip) {
  padding: 0 18px 10px;
}
.log-panel {
  flex: none;
  margin: 0 18px 10px;
  border: 1px solid var(--line);
  border-radius: 2px;
}
.log-panel summary {
  padding: 8px 12px;
  font-size: 13px;
  color: var(--soft);
  cursor: pointer;
}
.log-panel ol {
  max-height: 150px;
  overflow: auto;
  margin: 0;
  padding: 4px 12px 10px;
  list-style: none;
  font-size: 12px;
}
.log-panel li {
  display: flex;
  gap: 12px;
  padding: 3px 0;
  color: var(--muted);
}
.log-panel time {
  font-family: var(--mono);
  color: #8b8c90;
}
.code-panel {
  flex: 1;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  margin: 0 18px 10px;
  border: 1px solid var(--line);
  border-radius: 2px;
  overflow: hidden;
}
.code-bar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--line);
}
.code-bar button {
  height: 26px;
  padding: 0 12px;
  border: 0;
  border-radius: 2px;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;
}
.code-bar button.active {
  background: #ffffff12;
  color: var(--text);
}
.code-bar small {
  margin-left: auto;
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
}
.code-panel pre {
  flex: 1;
  min-height: 0;
  overflow: auto;
  margin: 0;
  padding: 10px 12px;
  font: 12px/1.6 var(--mono);
  color: #cfd2d6;
  tab-size: 2;
}
.detail-actions {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 10px 18px;
  border-top: 1px solid var(--line);
}
.detail-actions .hint {
  margin-right: auto;
  font-size: 12px;
  color: var(--muted);
}
@media (max-width: 1100px) {
  .referee-layout {
    grid-template-columns: 1fr;
    height: auto;
  }
  .list-panel {
    min-height: 320px;
  }
}
</style>
