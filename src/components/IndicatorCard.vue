<script setup>
import { computed } from 'vue'
import { Check, Ban } from 'lucide-vue-next'
import keyIcon from '../assets/material-symbols/key.svg?inline'
import lockIcon from '../assets/game-ui/lock.png?inline'
import { indicatorStates, toggle } from '../state.js'
import IndicatorPopover from './IndicatorPopover.vue'
import Halftone from './Halftone.vue'
const props = defineProps({ item: Object })
const state = computed(() => props.item && indicatorStates.value[props.item.id])
const iconMask = icon => ({ maskImage: `url("${icon}")` })
</script>

<template>
  <IndicatorPopover v-if="item" :item="item">
      <button class="indicator" :class="{ selected: state.selected, conflict: state.conflict, locked: state.locked, 'key-card': item.key }" :aria-label="`${item.name}，${item.level}级${state.selected ? '，已选中' : ''}`" :aria-pressed="state.selected" :aria-disabled="state.locked" @click="toggle(item)">
        <span v-if="!item.locked && !item.key" class="reward-mark"><img src="/assets/first-clear.png" alt="" /></span>
        <span v-if="state.selected" class="selected-check"><Check :size="20" :stroke-width="4" /></span>
        <Halftone v-if="state.selected" class="card-halftone" color="#3d0006" :cell="4" :angle="135" :from="0.3" />
        <img :src="item.icon" alt="" draggable="false" class="indicator-icon" />
        <span v-if="state.conflict" class="conflict-mask"><span>冲突</span><Ban :size="25" /></span>
        <span v-if="item.key" class="key-label" role="img" aria-label="锁闭指标">
          <span class="contract-symbol key-symbol" :style="iconMask(keyIcon)" aria-hidden="true" />
          <span class="key-marquee" aria-hidden="true"><span class="key-marquee-track"><span v-for="copy in 2" :key="copy">{{ '//KEY '.repeat(8) }}</span></span></span>
        </span>
        <span v-else-if="item.locked" class="lock-mark" :class="{ unlocked: !state.locked }" :style="{ '--lock-icon': `url(${lockIcon})` }" role="img" :aria-label="state.locked ? '未解锁' : '已解锁'" />
        <span v-for="corner in ['tl', 'tr', 'bl', 'br']" :key="corner" class="card-corner" :class="`corner-${corner}`" />
      </button>
    <template #hint><small>{{ state.hint }}</small></template>
  </IndicatorPopover>
  <div v-else class="indicator empty-indicator" aria-hidden="true"><span class="empty-cross" /><span v-for="corner in ['tl', 'tr', 'bl', 'br']" :key="corner" class="card-corner" :class="`corner-${corner}`" /></div>
</template>

<style scoped>
.indicator { position: relative; width: var(--card-width); height: var(--card-height); border: 1.5px solid #5d5e60; background: #121314; padding: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #ecebe9; transition: background-color .15s, border-color .15s, transform .15s, box-shadow .15s, filter .15s; outline-offset: 3px; z-index: 2 }
.indicator:hover { transform: translateY(-2px) }
.indicator:not(.selected):hover { background-color: #292a2b; border-color: #c1c0b9 }
.indicator:active { transform: translateY(0) scale(.97) }
.indicator-icon { width: 56%; height: 58%; opacity: .87; object-fit: contain; transition: opacity .15s }
.indicator.selected { background-color: #a10810; background-image: linear-gradient(155deg, #b81716, #a10810 75%); border-color: #f02023; box-shadow: 0 0 16px #ff1a2a66, inset 0 0 12px #ff241a22 }
.card-halftone { z-index: -1; opacity: .55 }
.indicator.selected:hover { filter: brightness(1.1); box-shadow: 0 0 26px #ff1a2a99, inset 0 0 12px #ff241a33 }
.indicator.selected .indicator-icon { opacity: 1 }
.card-corner { position: absolute; width: 7px; height: 4px; background: #737474; pointer-events: none }
.corner-tl { top: -3px; left: -3px }.corner-tr { top: -3px; right: -3px }.corner-bl { bottom: -3px; left: -3px }.corner-br { bottom: -3px; right: -3px }
.selected .card-corner { background: #ff2727 }
.reward-mark { position: absolute; top: 5px; left: 5px; fill: #e9e9e9; color: #24262a; background: #ececec; padding: 1px; width: 17px; height: 19px; clip-path: polygon(0 0, 100% 0, 100% 80%, 50% 100%, 0 80%) }
.selected-check { position: absolute; top: 3px; right: 3px; color: #b81012; background: #f3f2ec; width: 23px; height: 23px; display: grid; place-items: center }
.conflict .indicator-icon { opacity: .37 }
.conflict-mask { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; background: linear-gradient(#ffffff27, #0008); font-size: clamp(15px, 1.05vw, 18px); font-weight: 400; letter-spacing: .04em; text-indent: .04em; pointer-events: none }
.conflict-mask svg { filter: drop-shadow(0 0 5px #e5356366) }
.empty-indicator { background: #1a1b1c; border-color: transparent; pointer-events: none }
.empty-indicator .card-corner { opacity: .18 }
.empty-cross { width: 44%; aspect-ratio: 1; background: linear-gradient(45deg, transparent calc(50% - 1px), #343637 calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)), linear-gradient(-45deg, transparent calc(50% - 1px), #343637 calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)) }
.key-card .indicator-icon { filter: brightness(0) saturate(100%) invert(74%) sepia(93%) saturate(1406%) hue-rotate(358deg) }
.key-label { position: absolute; left: 2px; bottom: 3px; right: 2px; color: #efb811; display: flex; flex-direction: column; gap: 1px; pointer-events: none }
.contract-symbol { display: block; background: #efb811; mask-repeat: no-repeat; mask-position: center; mask-size: contain }
.key-symbol { width: 26px; height: 18px; mask-size: 26px 26px }
.key-marquee { overflow: hidden; background: #d69d00; color: #332600; line-height: 11px; text-align: left }
.key-marquee-track { display: flex; width: max-content; animation: key-scroll 9s linear infinite }
.key-marquee-track > span { flex: none; font: italic 800 8px/11px Arial, sans-serif; white-space: pre }
@keyframes key-scroll { to { transform: translateX(-50%) } }
@media (prefers-reduced-motion: reduce) { .key-marquee-track { animation: none } }
.lock-mark { position: absolute; bottom: 3px; left: 3px; width: 20px; height: 20px; pointer-events: none }
.lock-mark::before, .lock-mark::after { content: ''; position: absolute; inset: 0; background: #efb811; mask: var(--lock-icon) center / contain no-repeat }
/* 原始 72px 贴图在 y=31 处分开锁梁和锁身；解锁只右移锁梁，保持原比例。 */
.lock-mark::before { clip-path: inset(0 0 calc(100% - 31 / 72 * 100%) 0) }
.lock-mark::after { clip-path: inset(calc(31 / 72 * 100%) 0 0 0) }
.lock-mark.unlocked::before { transform: translateX(calc(24 / 72 * 100%)) }
.locked { cursor: not-allowed; background-image: linear-gradient(transparent 70%, #ad7e0025) }
.locked .indicator-icon { opacity: .55 }
.reward-mark > img { width: 100%; height: 100%; display: block; filter: brightness(0) }
</style>
