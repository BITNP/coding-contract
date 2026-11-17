<script setup>
import { useId } from 'vue'

defineProps({
  icon: [Object, Function],
  label: String,
  progress: { type: Number, default: 1 },
  tone: { type: String, default: 'ready' },
  struck: Boolean,
  action: Boolean,
})
defineEmits(['activate'])

const radius = 12
const circumference = 2 * Math.PI * radius
const eraser = `ring-eraser-${useId().replace(/\W/g, '')}`
</script>

<template>
  <button
    class="status-ring"
    :class="[tone, { struck }]"
    type="button"
    :title="label"
    :aria-label="label"
    :aria-disabled="!action"
    @click="action && $emit('activate')"
  >
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <mask :id="eraser" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
        <rect width="32" height="32" fill="#fff" />
        <line class="slash eraser" x1="6" y1="6" x2="26" y2="26" pathLength="1" />
      </mask>
      <g :mask="`url(#${eraser})`">
        <circle class="track" cx="16" cy="16" :r="radius" />
        <circle
          class="arc"
          cx="16"
          cy="16"
          :r="radius"
          transform="rotate(-90 16 16)"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="circumference * (1 - progress)"
        />
        <Transition name="ring-icon" mode="out-in">
          <g v-if="icon" :key="label" class="glyph">
            <component :is="icon" x="10" y="10" :size="12" :stroke-width="2.25" />
          </g>
        </Transition>
      </g>
      <line class="slash strike" x1="6" y1="6" x2="26" y2="26" pathLength="1" />
    </svg>
  </button>
</template>

<style scoped>
.status-ring {
  --delay: 0s;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  flex: none;
  border: 0;
  border-radius: 50%;
  background: none;
  color: var(--text);
  cursor: default;
  transition: color 0.25s var(--delay);
}
svg {
  width: 32px;
  height: 32px;
  overflow: visible;
  transition: filter 0.25s var(--delay);
}
circle {
  fill: none;
  stroke-width: 2;
}
.track {
  stroke: #ffffff1f;
}
.arc {
  stroke: currentColor;
  stroke-linecap: round;
  transition:
    stroke-dashoffset 0.3s ease,
    opacity 0.25s var(--delay);
}
.ready svg {
  filter: drop-shadow(0 0 4px #ffffff55);
}
.error {
  color: var(--gold);
  cursor: pointer;
}
.error:hover {
  filter: brightness(1.15);
}
.error .track {
  stroke: #efb81133;
}
.off {
  color: var(--muted);
}
.off .arc {
  opacity: 0.35;
}
.struck {
  color: #5d5e60;
}
.struck svg {
  filter: none;
}
.struck .arc {
  opacity: 0;
}
.slash {
  stroke-linecap: round;
  stroke-dasharray: 1 2;
  stroke-dashoffset: 1.2;
  transition: stroke-dashoffset 0.3s cubic-bezier(0.6, 0, 0.3, 1) var(--delay);
}
.strike {
  stroke: color-mix(in srgb, var(--red) 40%, #1a1b1e);
  stroke-width: 2.25;
}
.eraser {
  stroke: #000;
  stroke-width: 6.25;
}
.struck .slash {
  stroke-dashoffset: 0;
}
.glyph {
  transform-box: fill-box;
  transform-origin: center;
}
.ring-icon-enter-active,
.ring-icon-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}
.ring-icon-enter-from,
.ring-icon-leave-to {
  opacity: 0;
  transform: scale(0.6);
}
</style>
