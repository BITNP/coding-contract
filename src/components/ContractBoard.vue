<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-vue-next'
import { groups, indicators, columnCount } from '../../shared/contracts.js'
import { selected, setSelection } from '../state.js'
import IndicatorCard from './IndicatorCard.vue'
import UiButton from './UiButton.vue'
import Halftone from './Halftone.vue'

const board = ref(null)
const progress = ref(0)
const thumb = ref(1)
const scrollable = ref(false)
const rows = [1, 2, 3].map((level) =>
  Array.from({ length: columnCount }, (_, column) =>
    indicators.find((item) => item.level === level && item.column === column),
  ),
)
const connections = groups.flatMap((group) =>
  group.variants.slice(1).map((item, index) => ({
    group: group.id,
    column: group.column,
    from: group.variants[index].level,
    to: item.level,
  })),
)
const activeGroups = computed(() => new Set(selected.value.map((item) => item.group)))
const scroll = (distance) => board.value.scrollBy({ left: distance, behavior: 'smooth' })
const clamp = (value) => Math.max(0, Math.min(1, value))
const range = () => board.value.scrollWidth - board.value.clientWidth
function updateProgress() {
  scrollable.value = range() > 1
  thumb.value = board.value.clientWidth / board.value.scrollWidth
  progress.value = scrollable.value ? clamp(board.value.scrollLeft / range()) : 0
}
function dragTrack(event) {
  if (!scrollable.value) return
  const track = event.currentTarget
  const rect = track.getBoundingClientRect()
  const width = rect.width * thumb.value
  const left = rect.left + progress.value * (rect.width - width)
  const grab = event.clientX >= left && event.clientX <= left + width ? event.clientX - left : width / 2
  const move = (e) => {
    board.value.scrollLeft = clamp((e.clientX - rect.left - grab) / (rect.width - width)) * range()
  }
  move(event)
  track.setPointerCapture(event.pointerId)
  track.onpointermove = move
  track.onpointerup = () => (track.onpointermove = null)
}
function wheel(event) {
  if (scrollable.value && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
    event.preventDefault()
    board.value.scrollLeft += event.deltaY
  }
}
const observer = new ResizeObserver(updateProgress)
onMounted(() => observer.observe(board.value))
onBeforeUnmount(() => observer.disconnect())
</script>

<template>
  <div class="contract-board">
    <div class="board-shell">
      <div class="tier-rail">
        <div v-for="level in 3" :key="level" class="tier" :data-level="level">
          <Halftone v-if="level === 3" class="tier-halftone" color="#fff" :cell="5" :angle="200" :from="0.25" />
          <span class="tier-deco" aria-hidden="true"><svg v-for="n in level" :key="n" viewBox="0 0 14 14"><path d="M1.5 1.5h11l-11 11z" /></svg></span><span class="tier-number">{{ level }}</span>
          <img src="/assets/risk-level.png" alt="级指标" />
        </div>
      </div>
      <div ref="board" v-scroll-fade:x="32" class="indicator-scroll" @wheel="wheel" @scroll="updateProgress">
        <div class="indicator-grid" :style="{ '--columns': columnCount }">
          <div v-for="(row, index) in rows" :key="index" class="indicator-row">
            <IndicatorCard v-for="(item, column) in row" :key="column" :item="item" />
          </div>
          <div v-for="link in connections" :key="`${link.group}-${link.from}`" class="indicator-connector" :class="{ active: activeGroups.has(link.group) }"
            :style="{ '--column': link.column, '--from': link.from - 1, '--span': link.to - link.from }" />
        </div>
      </div>
    </div>
    <div class="board-toolbar">
      <div class="scroll-hint">
        <UiButton kind="ghost" icon-only :disabled="!scrollable" aria-label="向左浏览指标" @click="scroll(-450)"><ChevronLeft :size="18" /></UiButton>
        <div
          class="scroll-track"
          :class="{ disabled: !scrollable }"
          role="scrollbar"
          aria-label="指标横向位置"
          :aria-valuenow="Math.round(progress * 100)"
          tabindex="0"
          :style="{ '--thumb': thumb, '--progress': progress }"
          @pointerdown.prevent="dragTrack"
          @keydown.left.prevent="scroll(-240)"
          @keydown.right.prevent="scroll(240)"
        ><span /></div>
        <UiButton kind="ghost" icon-only :disabled="!scrollable" aria-label="向右浏览指标" @click="scroll(450)"><ChevronRight :size="18" /></UiButton>
        <span>{{ scrollable ? '横向滚动浏览全部指标' : '已显示全部指标' }}</span>
      </div>
      <UiButton kind="dark" :disabled="!selected.length" @click="setSelection([])"><RotateCcw :size="19" />清空选择</UiButton>
    </div>
  </div>
</template>

<style scoped>
.contract-board { min-width: 0 }
.board-shell { height: var(--board-inner); display: flex; min-width: 0; position: relative; border-right: 2px solid #77797e; padding-right: 3px }
.tier-rail { width: var(--rail-width); flex-shrink: 0; display: flex; flex-direction: column; gap: var(--row-gap); z-index: 3; background: #101214; border-right: 2px solid #656566 }
.tier { isolation: isolate; height: calc(var(--row-height) - var(--row-gap)); display: flex; align-items: center; justify-content: center; gap: 4px; background: linear-gradient(110deg, #363638, #262728); border-left: 5px solid var(--orange); position: relative; border-radius: 3px 0 0 3px }
.tier[data-level='2'] { border-color: #ff5410 }
.tier[data-level='3'] { border-color: #ff121d }
.tier::after { content: ''; position: absolute; left: -9px; top: 6px; bottom: 6px; width: 3px; background: repeating-linear-gradient(45deg, #ffffff55 0 1px, transparent 1px 4px) }
.tier-number { font: 400 clamp(40px, 3vw, 52px)/1 var(--font-num); color: #fff; text-shadow: 0 0 6px #ffffff99, 0 0 18px #ffffff40 }
.tier[data-level='2'] .tier-number { text-shadow: 0 0 6px #ffc48a, 0 0 16px #ff8a2acc, 0 0 32px #ff6a0066 }
.tier[data-level='3'] .tier-number { text-shadow: 0 0 6px #ff9fb4, 0 0 16px #ff2f5ccc, 0 0 32px #ff1f5177 }
.tier img { filter: drop-shadow(0 0 6px #ffffff55) }
.tier-halftone { z-index: -1; opacity: .13 }
.tier img { width: clamp(24px, 1.7vw, 30px) }
.tier-deco { position: absolute; top: 6px; right: 6px; display: flex; flex-direction: column; gap: 3px }
.tier-deco svg { width: 13px; height: 13px; fill: none; stroke: #ffffff2e; stroke-width: 1.2 }
.indicator-scroll { overflow: auto hidden; min-width: 0; overscroll-behavior-x: contain; flex: 1 }
.indicator-grid { position: relative; isolation: isolate; width: calc(var(--columns) * (var(--card-width) + var(--column-gap)) + 16px); height: 100%; padding: 0 20px }
.indicator-row { display: grid; grid-template-columns: repeat(var(--columns), var(--card-width)); column-gap: var(--column-gap); align-items: center; height: var(--row-height); padding-bottom: 8px; position: relative }
.indicator-row::before { content: ''; position: absolute; inset: 0 -20px 8px; background: #121314ed; z-index: -1; border-bottom: 1px solid #292a2d }
.indicator-connector { --cap-height: 6px; position: absolute; z-index: 1; pointer-events: none; left: calc(20px + var(--column) * (var(--card-width) + var(--column-gap)) + var(--card-width) / 2); top: calc(var(--from) * var(--row-height) + (var(--row-height) + var(--card-height)) / 2 - 4px - var(--cap-height) / 2); width: clamp(18px, 1.2vw, 24px); height: calc(var(--span) * var(--row-height) - var(--card-height) + var(--cap-height)); transform: translateX(-50%); color: #5d5e60; transition: color .15s; background: linear-gradient(currentColor, currentColor) center / 4px calc(100% - var(--cap-height) * 2) no-repeat }
.indicator-connector::before, .indicator-connector::after { content: ''; position: absolute; left: 0; width: 100%; height: var(--cap-height); background: linear-gradient(to right, currentColor calc(50% - 2px), transparent calc(50% - 2px) calc(50% + 2px), currentColor calc(50% + 2px)) }
.indicator-connector.active { color: #d50916 }
.indicator-connector::before { top: 0 }.indicator-connector::after { bottom: 0 }
.board-toolbar { display: flex; justify-content: space-between; height: var(--toolbar-height); align-items: center; padding-left: var(--rail-width) }
.board-toolbar > .ui-button { height: 34px; padding: 0 16px; font-size: 14px }
.scroll-hint { display: flex; align-items: center; gap: 6px; color: var(--text); font-size: 14px }
.scroll-hint .ui-button { width: 24px; height: 28px }
.scroll-track { position: relative; width: clamp(160px, 13vw, 240px); height: 20px; cursor: pointer; touch-action: none; outline-offset: 2px }
.scroll-track::before { content: ''; position: absolute; left: 0; right: 0; top: 9px; height: 2px; background: #44484f }
.scroll-track > span { position: absolute; top: 8px; height: 4px; width: calc(var(--thumb) * 100%); left: calc(var(--progress) * (1 - var(--thumb)) * 100%); background: #bebdb7; border-radius: 2px; transition: background .15s, height .15s, top .15s }
.scroll-track:hover > span, .scroll-track:active > span { top: 7px; height: 6px; background: var(--text) }
.scroll-track.disabled { cursor: default; opacity: .4 }
.scroll-hint > span { margin-left: 10px }
@media (max-width: 1280px) { .scroll-hint > span { display: none } }
</style>
