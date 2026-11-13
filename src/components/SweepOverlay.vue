<script setup>
import { nextTick, ref } from 'vue'
import { registerSweep } from '../sweep.js'

const layers = ['spark', 'red', 'flash', 'crimson', 'ink', 'base']
const active = ref(false)
const bands = ref([])
const easing = 'cubic-bezier(.76, 0, .24, 1)'
const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

function move(from, to, duration, delays) {
  return Promise.all(
    bands.value.map(
      (band, index) =>
        band.animate([{ transform: `translateX(${from})` }, { transform: `translateX(${to})` }], {
          duration,
          delay: delays(index),
          easing,
          fill: 'forwards',
        }).finished,
    ),
  )
}

registerSweep(async (action) => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return action()
  active.value = true
  await nextTick()
  await move('145vw', '0vw', 460, (i) => i * 85)
  try {
    return await action()
  } finally {
    await frame()
    await move('0vw', '-150vw', 440, (i) => (layers.length - 1 - i) * 60)
    bands.value.forEach((band) => band.getAnimations().forEach((animation) => animation.cancel()))
    active.value = false
  }
})
</script>

<template>
  <div v-if="active" class="sweep" aria-hidden="true">
    <div v-for="layer in layers" :key="layer" ref="bands" class="sweep-band" :class="layer"><i /></div>
  </div>
</template>

<style>
.sweep { position: fixed; inset: 0; z-index: 9999; overflow: hidden; pointer-events: all }
.sweep-band { position: absolute; top: -10vh; bottom: -10vh; left: -25vw; width: 150vw; transform: translateX(145vw); will-change: transform }
.sweep-band > i { position: absolute; inset: 0; transform: skewX(-24deg) }
.sweep-band > i::before { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 10px }
.sweep-band.spark { width: 3vw }
.sweep-band.spark > i { background: #e9e8e5 }
.sweep-band.flash { width: 7vw }
.sweep-band.flash > i { background: #ff2a50 }
.sweep-band.red > i { background: #e50032 }
.sweep-band.red > i::before { background: #ff8aa0 }
.sweep-band.crimson > i { background: #8a0020 }
.sweep-band.crimson > i::before { background: #e50032 }
.sweep-band.ink > i { background: repeating-linear-gradient(-66deg, #ffffff08 0 2px, transparent 2px 14px), #24090f }
.sweep-band.ink > i::before { width: 4px; background: #e9e8e5 }
.sweep-band.base > i { background: var(--bg) }
.sweep-band.base > i::before { width: 3px; background: #ff640c }
</style>
