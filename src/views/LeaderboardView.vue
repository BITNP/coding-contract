<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Clock3, Code2, Trophy } from 'lucide-vue-next'
import { api } from '../api'
import Halftone from '../components/Halftone.vue'
import Digits from '../components/Digits.vue'
import IndicatorStrip from '../components/IndicatorStrip.vue'

const interval = 12_000
const perPage = 10
const accents = ['#efb811', '#c9cdd3', '#ff640c']
const entries = ref([])
const status = ref('loading')
const syncedAt = ref('')
const page = ref(0)

const podium = computed(() => accents.map((_, index) => entries.value[index]))
const rest = computed(() => entries.value.slice(3))
const pages = computed(() => Math.max(1, Math.ceil(rest.value.length / perPage)))
const current = computed(() => page.value % pages.value)
const rows = computed(() => rest.value.slice(current.value * perPage, (current.value + 1) * perPage))
const statusText = { loading: '正在同步', live: '实时同步', offline: '连接中断 · 正在重试' }
const emptyText = { loading: '正在同步排行榜', live: '暂无上榜记录', offline: '排行榜连接中断' }

const pad = (value) => String(value).padStart(2, '0')
const initial = (name) => Array.from(name.trim())[0]?.toUpperCase()
function clock(ms) {
  if (!Number.isFinite(ms)) return '--:--'
  const seconds = Math.floor(ms / 1000)
  const time = `${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`
  return seconds < 3600 ? time : `${Math.floor(seconds / 3600)}:${time}`
}

async function load() {
  try {
    entries.value = await api.leaderboard()
    syncedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    status.value = 'live'
  } catch {
    status.value = 'offline'
  }
}

const timer = setInterval(async () => {
  await load()
  page.value++
}, interval)
onMounted(load)
onBeforeUnmount(() => clearInterval(timer))

const toggleFullscreen = () =>
  document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()
</script>

<template>
  <main class="leaderboard" @dblclick="toggleFullscreen">
    <header class="board-head">
      <img class="board-watermark" src="/assets/endfield.svg" alt="" />
      <span class="board-marker" />
      <div>
        <p class="board-event">网协合约<i>·</i>开拓测试作战</p>
        <h1>排行榜<small>LEADERBOARD</small></h1>
        <div class="board-decoration">▲ ▲ ▲ ▲<span /></div>
      </div>
      <div class="board-meta">
        <div class="board-count">
          <strong><Digits :value="pad(entries.length)" /></strong><span>上榜人数</span>
        </div>
        <span class="board-status" :data-status="status"
          ><i />{{ statusText[status] }}<span v-if="status === 'live'">{{ syncedAt }}</span></span
        >
      </div>
    </header>

    <section v-if="entries.length" class="board-body">
      <TransitionGroup appear name="podium" tag="ol" class="podium">
        <li
          v-for="(entry, index) in podium"
          :key="entry?.id ?? `vacant-${index}`"
          class="podium-card"
          :class="{ vacant: !entry }"
          :style="{ gridRow: index + 1, '--s': index ? 1 : 1.22, '--accent': entry && accents[index] }"
        >
          <Halftone
            v-if="entry"
            class="podium-halftone"
            :color="accents[index]"
            :cell="6"
            :origin="[1, 0]"
            :radius="0.9"
            :gamma="1.8"
          />
          <span class="podium-rank num">{{ pad(index + 1) }}</span>
          <template v-if="entry">
            <span class="avatar"
              >{{ initial(entry.name)
              }}<img
                v-if="entry.avatar"
                :src="entry.avatar"
                alt=""
                referrerpolicy="no-referrer"
                @error="$event.target.hidden = true"
            /></span>
            <h2>{{ entry.name }}</h2>
            <p class="podium-meta">
              <span><Code2 />{{ entry.language }}</span>
              <span><Clock3 /><b>{{ clock(entry.durationMs) }}</b></span>
            </p>
            <div class="entry-question">
              <span>{{ entry.question }}</span>
              <IndicatorStrip :ids="entry.contracts" />
            </div>
            <span class="score"
              ><strong class="num">{{ entry.score }}</strong><img src="/assets/risk-level.webp" alt=""
            /></span>
          </template>
          <p v-else class="vacant-note">虚位以待</p>
        </li>
      </TransitionGroup>

      <div class="board-list" :style="{ '--interval': `${interval}ms` }">
        <Transition name="board-page" mode="out-in">
          <TransitionGroup :key="current" appear name="row" tag="ol" class="rows">
            <li
              v-for="(entry, index) in rows"
              :key="entry.id"
              class="row"
              :style="{ gridRow: index + 1, '--i': index }"
            >
              <b class="row-rank num">{{ pad(entry.rank) }}</b>
              <span class="avatar"
                >{{ initial(entry.name)
                }}<img
                  v-if="entry.avatar"
                  :src="entry.avatar"
                  alt=""
                  referrerpolicy="no-referrer"
                  @error="$event.target.hidden = true"
              /></span>
              <div class="row-copy">
                <h3>{{ entry.name }}</h3>
                <p><Code2 />{{ entry.language }}<i /><Clock3 />{{ clock(entry.durationMs) }}</p>
              </div>
              <div class="entry-question">
                <span>{{ entry.question }}</span>
                <IndicatorStrip :ids="entry.contracts" />
              </div>
              <span class="score"
                ><strong class="num">{{ entry.score }}</strong><img src="/assets/risk-level.webp" alt=""
              /></span>
            </li>
          </TransitionGroup>
        </Transition>
        <p v-if="!rest.length" class="rows-vacant">- 虚位以待 -</p>
        <footer v-if="pages > 1" class="pager">
          <span class="num">
            {{ pad(rows[0].rank) }} – {{ pad(rows.at(-1).rank) }}<small> / {{ pad(entries.length) }}</small>
          </span>
          <span class="pager-track">
            <i v-for="n in pages" :key="n" :class="{ active: n - 1 === current }" />
          </span>
        </footer>
      </div>
    </section>

    <section v-else class="board-empty">
      <Trophy :stroke-width="1" />
      <h2>- {{ emptyText[status] }} -</h2>
      <p v-if="status === 'live'">作战提交通过后，成绩将在此实时公布</p>
    </section>
  </main>
</template>

<style scoped>
:global(.app-shell:has(.leaderboard)) {
  min-width: 0;
}
.leaderboard {
  position: relative;
  z-index: 1;
  height: calc(100dvh - var(--page-bottom));
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 2.6vmin;
  padding: 2.4vmin 0 2vmin;
  user-select: none;
}

.board-head {
  position: relative;
  display: flex;
  align-items: center;
  gap: 2.4vmin;
}
.board-head::after {
  content: '';
  position: absolute;
  inset: auto 0 -1.3vmin;
  height: 1px;
  background: linear-gradient(90deg, #ffffff38, #ffffff0a 70%);
}
.board-watermark {
  position: absolute;
  width: 20vmin;
  height: 20vmin;
  top: -6vmin;
  left: -2vmin;
  opacity: 0.08;
  filter: brightness(0) invert(1);
  pointer-events: none;
}
.board-marker {
  align-self: stretch;
  width: 1.4vmin;
  border-left: 0.6vmin solid #ededed;
  background: repeating-linear-gradient(45deg, #ededed 0 2px, transparent 2px 5px);
}
.board-event {
  font-size: 1.7vmin;
  letter-spacing: 0.24em;
  color: var(--soft);
}
.board-event i {
  font-style: normal;
  margin: 0 0.6em;
  color: var(--orange);
}
.board-head h1 {
  display: flex;
  align-items: baseline;
  gap: 1.8vmin;
  margin-top: 0.2vmin;
  font-size: 5.2vmin;
  line-height: 1.05;
  letter-spacing: 0.14em;
}
.board-head h1 small {
  font: 400 1.5vmin var(--font-display);
  letter-spacing: 0.32em;
  color: var(--muted);
}
.board-decoration {
  display: flex;
  align-items: center;
  gap: 1vmin;
  margin-top: 0.4vmin;
  color: #a0a3a6;
  font-size: 0.9vmin;
  letter-spacing: 0.4vmin;
}
.board-decoration span {
  width: 9vmin;
  height: 0.5vmin;
  background: repeating-linear-gradient(135deg, #73767b 0 1px, transparent 1px 3px);
}
.board-meta {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4vmin;
}
.board-count {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.board-count strong {
  font-size: 5.2vmin;
  line-height: 0.9;
}
.board-count > span {
  margin-top: 0.4vmin;
  font-size: 1.5vmin;
  letter-spacing: 0.12em;
  color: var(--soft);
}
.board-status {
  display: flex;
  align-items: center;
  gap: 1.2vmin;
  padding: 0.8vmin 1.6vmin;
  border: 1px solid #ffffff1f;
  font-size: 1.6vmin;
  letter-spacing: 0.06em;
  color: var(--soft);
}
.board-status i {
  width: 1.1vmin;
  height: 1.1vmin;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 1.4vmin var(--green);
  animation: pulse 2s ease-in-out infinite;
}
.board-status[data-status='loading'] i {
  background: var(--muted);
  box-shadow: none;
}
.board-status[data-status='offline'] i {
  background: var(--red);
  box-shadow: 0 0 1.4vmin var(--red);
}

.board-body {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 40fr) minmax(0, 60fr);
  gap: 2.6vmin;
}
.podium,
.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  min-height: 0;
}
.podium {
  grid-template-rows: 1.3fr 1fr 1fr;
  gap: 1.8vmin;
}
.podium-card {
  --accent: #4a4b50;
  position: relative;
  isolation: isolate;
  overflow: hidden;
  grid-column: 1;
  display: grid;
  grid-template:
    'avatar name score' auto
    'avatar meta score' auto
    'question question question' auto / auto minmax(0, 1fr) auto;
  align-content: center;
  column-gap: calc(2.4vmin * var(--s));
  padding: 2.4vmin 3vmin 2vmin;
  border-left: 0.6vmin solid var(--accent);
  background: linear-gradient(105deg, #2e2f33, #232428 55%, color-mix(in srgb, var(--accent) 18%, #232428));
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 3vmin), calc(100% - 3vmin) 100%, 0 100%);
}
.podium-halftone {
  z-index: -1;
  opacity: 0.2;
}
.podium-rank {
  position: absolute;
  top: 0;
  left: 0;
  padding: 0.3vmin 2.6vmin 0.3vmin 1.6vmin;
  font-size: calc(2.6vmin * var(--s));
  line-height: 1.1;
  color: #16171a;
  background: var(--accent);
  clip-path: polygon(0 0, 100% 0, calc(100% - 1.4vmin) 100%, 0 100%);
}
.podium-card .avatar {
  grid-area: avatar;
  width: calc(8.4vmin * var(--s));
  font-size: calc(3.8vmin * var(--s));
  box-shadow:
    0 0 0 0.35vmin var(--accent),
    0 0 3vmin color-mix(in srgb, var(--accent) 40%, transparent);
}
.podium-card h2 {
  grid-area: name;
  align-self: end;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: calc(3.8vmin * var(--s));
  font-weight: 500;
  line-height: 1.2;
  color: #fff;
}
.podium-meta {
  grid-area: meta;
  min-width: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 1.6vmin;
  margin-top: 0.6vmin;
  font-size: 1.8vmin;
  color: var(--soft);
}
.podium-meta > * {
  display: inline-flex;
  align-items: center;
  gap: 0.8vmin;
  white-space: nowrap;
}
.podium-meta svg {
  width: 2vmin;
  height: 2vmin;
  color: var(--muted);
}
.podium-meta b {
  font-size: 2vmin;
  font-weight: 500;
  color: var(--text);
}
.podium-card .score {
  grid-area: score;
  align-self: center;
}
.podium-card .score strong {
  font-size: calc(7.2vmin * var(--s));
}
.podium-card .score img {
  width: calc(4.4vmin * var(--s));
  height: calc(5vmin * var(--s));
}
.vacant {
  background: #1e1f2299;
  outline: 1px dashed #ffffff1a;
  outline-offset: -1px;
}
.vacant-note {
  grid-column: 1 / -1;
  grid-row: 1 / -1;
  text-align: center;
  font-size: 2.4vmin;
  letter-spacing: 0.4em;
  color: #6f747d;
}

.avatar {
  position: relative;
  flex: none;
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  border-radius: 50%;
  background: linear-gradient(140deg, #4a4b50, #2a2b2f);
  font-weight: 500;
  color: var(--light);
}
.avatar img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
  background: #2a2b2f;
}
h2,
h3 {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.score {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.6vmin;
}
.score strong {
  font-weight: 400;
  line-height: 1;
}

.board-list {
  --columns: 8vmin 5.6vmin minmax(0, 1fr) 34vmin 13vmin;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
}
.row {
  display: grid;
  grid-template-columns: var(--columns);
  align-items: center;
  column-gap: 2vmin;
  padding-right: 2.6vmin;
}
.rows {
  grid-area: 1 / 1;
  grid-template-rows: repeat(10, minmax(0, 1fr));
  gap: 0.9vmin;
}
.row {
  position: relative;
  overflow: hidden;
  grid-column: 1;
  min-height: 0;
  background: linear-gradient(90deg, #2c2d31f0, #232427e6);
}
.row::after {
  content: '';
  position: absolute;
  inset: 0 0 0 auto;
  width: 6vmin;
  pointer-events: none;
  opacity: 0.035;
  background: repeating-linear-gradient(135deg, transparent 0 15px, white 15px 26px);
}
.row-rank {
  align-self: stretch;
  display: grid;
  place-items: center;
  font-size: 3.4vmin;
  font-weight: 400;
  color: var(--soft);
  background: #ffffff0d;
}
.row .avatar {
  height: 72%;
  justify-self: center;
  font-size: 2.4vmin;
}
.row-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.3vmin;
  padding-top: 0.6vmin;
}
.row-copy h3 {
  font-size: 2.6vmin;
  font-weight: 500;
  line-height: 1.15;
  color: var(--text);
}
.row-copy p {
  display: flex;
  align-items: center;
  gap: 0.7vmin;
  font-size: 1.6vmin;
  color: var(--muted);
  white-space: nowrap;
}
.row-copy svg {
  width: 1.9vmin;
  height: 1.9vmin;
}
.row-copy i {
  width: 1px;
  height: 1.6vmin;
  margin: 0 1vmin;
  background: #ffffff26;
}
.entry-question {
  --indicator-size: 2.3vmin;
  display: flex;
  align-items: center;
  gap: 1vmin;
  font-size: 1.8vmin;
  color: var(--soft);
}
.entry-question > span {
  flex: none;
}
.podium-card .entry-question {
  --indicator-size: calc(3.2vmin * var(--s));
  grid-area: question;
  margin-top: 1.8vmin;
  font-size: calc(2.4vmin * var(--s));
}
.row .score {
  align-self: stretch;
  padding-left: 2vmin;
  border-left: 1px solid #ffffff14;
}
.row .score strong {
  font-size: 4.4vmin;
}
.row .score img {
  width: 2.6vmin;
  height: 3vmin;
}
.rows-vacant {
  grid-area: 1 / 1;
  align-self: center;
  text-align: center;
  font-size: 2.4vmin;
  letter-spacing: 0.3em;
  color: #6f747d;
}
.pager {
  display: flex;
  align-items: center;
  gap: 2.4vmin;
  padding-top: 1.4vmin;
  font-size: 2.4vmin;
  color: var(--soft);
}
.pager small {
  font-size: 1.8vmin;
  color: var(--muted);
}
.pager-track {
  flex: 1;
  display: flex;
  gap: 0.6vmin;
}
.pager-track i {
  position: relative;
  flex: 1;
  height: 0.5vmin;
  overflow: hidden;
  background: #ffffff1a;
}
.pager-track i.active::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--orange);
  transform-origin: left;
  animation: progress var(--interval) linear both;
}

.board-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2vmin;
  border: 1px dashed #ffffff14;
  color: #6f747d;
}
.board-empty svg {
  width: 8vmin;
  height: 8vmin;
}
.board-empty h2 {
  font-size: 3.6vmin;
  font-weight: 400;
  letter-spacing: 0.08em;
  color: var(--soft);
}
.board-empty p {
  font-size: 2.2vmin;
}

.podium-move,
.row-move {
  transition: transform 0.7s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.podium-enter-active,
.podium-leave-active,
.row-enter-active,
.row-leave-active {
  transition:
    opacity 0.45s,
    transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.row-enter-active {
  transition-delay: calc(var(--i) * 45ms);
}
.podium-enter-from,
.podium-leave-to {
  opacity: 0;
  transform: translateX(-4vmin);
}
.row-enter-from,
.row-leave-to {
  opacity: 0;
  transform: translateX(4vmin);
}
.board-page-leave-active {
  transition: opacity 0.35s;
}
.board-page-leave-to {
  opacity: 0;
}

@media (max-width: 800px) {
  .leaderboard {
    height: auto;
    min-height: calc(100dvh - var(--page-bottom));
  }
  .board-body {
    grid-template-columns: minmax(0, 1fr);
  }
  .podium-card {
    min-height: 110px;
  }
  .row {
    min-height: 54px;
  }
  .rows {
    grid-template-rows: none;
  }
  .podium-card h2, .row-copy h3 {
    font-size: 16px;
  }
  .podium-meta, .podium-meta b, .row-copy p, .entry-question, .podium-card .entry-question {
    font-size: 12px;
  }
  .entry-question {
    --indicator-size: 16px;
    flex-wrap: wrap;
  }
  .podium-card .entry-question {
    --indicator-size: 18px;
  }
}

@keyframes pulse {
  50% {
    opacity: 0.35;
  }
}
@keyframes progress {
  from {
    transform: scaleX(0);
  }
}
</style>
