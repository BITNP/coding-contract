<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  color: { type: String, default: '#000' },
  cell: { type: Number, default: 6 },
  size: { type: Number, default: 1.15 },
  angle: { type: Number, default: 90 },
  from: { type: Number, default: 0 },
  to: { type: Number, default: 1 },
  origin: { type: Array, default: null },
  radius: { type: Number, default: 1 },
  screen: { type: Number, default: 45 },
  gamma: { type: Number, default: 1.4 },
  jitter: { type: Number, default: 0.12 },
})

const canvas = ref(null)
let frame = 0
const clamp = (value) => Math.max(0, Math.min(1, value))
const noise = (x, y) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n) - 0.5
}

function draw() {
  frame = 0
  const element = canvas.value
  if (!element) return
  const { width, height } = element.getBoundingClientRect()
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  element.width = Math.round(width * ratio)
  element.height = Math.round(height * ratio)
  const ctx = element.getContext('2d')
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, width, height)
  if (!width || !height) return

  const rad = (props.angle * Math.PI) / 180
  const dx = Math.sin(rad)
  const dy = -Math.cos(rad)
  const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2
  const reach = props.origin && props.radius * Math.hypot(width, height)
  const span = props.to - props.from || 1
  const tone = (x, y) => {
    const t = props.origin
      ? 1 - Math.hypot(x - props.origin[0] * width, y - props.origin[1] * height) / reach
      : ((x - width / 2) * dx + (y - height / 2) * dy + half) / (2 * half)
    return clamp((t - props.from) / span + noise(x, y) * props.jitter)
  }

  const screen = (props.screen * Math.PI) / 180
  const cos = Math.cos(screen)
  const sin = Math.sin(screen)
  const step = props.cell
  const extent = Math.ceil(Math.hypot(width, height) / 2 / step) + 1
  const maxRadius = (props.size * step) / 2
  ctx.fillStyle = props.color
  ctx.beginPath()
  for (let i = -extent; i <= extent; i++) {
    for (let j = -extent; j <= extent; j++) {
      const x = width / 2 + (i * cos - j * sin) * step
      const y = height / 2 + (i * sin + j * cos) * step
      if (x < -step || y < -step || x > width + step || y > height + step) continue
      const r = maxRadius * Math.pow(tone(x, y), props.gamma)
      if (r < 0.3) continue
      ctx.moveTo(x + r, y)
      ctx.arc(x, y, r, 0, Math.PI * 2)
    }
  }
  ctx.fill()
}

const schedule = () => {
  if (!frame) frame = requestAnimationFrame(draw)
}
const observer = new ResizeObserver(schedule)
onMounted(() => {
  observer.observe(canvas.value)
  draw()
})
watch(() => ({ ...props }), schedule)
onBeforeUnmount(() => {
  observer.disconnect()
  cancelAnimationFrame(frame)
})
</script>

<template>
  <canvas ref="canvas" class="halftone" aria-hidden="true" />
</template>

<style>
.halftone { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; border-radius: inherit }
</style>
