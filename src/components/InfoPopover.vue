<script setup>
import { NPopover } from 'naive-ui'
defineProps({
  title: String,
  placement: { type: String, default: 'bottom' },
  accent: { type: String, default: 'var(--red)' },
  width: { type: Number, default: 280 },
  large: Boolean,
})
</script>

<template>
  <NPopover
    trigger="hover"
    :placement="placement"
    :delay="0"
    :duration="0"
    :show-arrow="false"
    :keep-alive-on-hover="false"
  >
    <template #trigger><slot name="trigger" /></template>
    <div
      class="info-popover"
      :class="{ 'info-popover--large': large }"
      :style="{ '--accent': accent, width: `${width}px` }"
    >
      <div class="info-heading"><slot name="heading">{{ title }}</slot></div>
      <div class="info-content"><slot /></div>
    </div>
  </NPopover>
</template>

<style>
.n-popover:has(.info-popover) {
  pointer-events: none;
  transition: none !important;
}
.n-popover.popover-transition-leave-active:has(.info-popover) {
  visibility: hidden;
}
.info-popover {
  color: #e7e7e5;
  background: #343537;
  box-shadow: 0 15px 30px #0005;
  border-bottom: 3px solid #494a4c;
}
.info-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 46px;
  padding: 8px 16px;
  background: var(--accent);
  font-size: 17px;
  letter-spacing: 0.02em;
}
.info-content {
  padding: 12px 16px 14px;
  font-size: 13px;
  color: var(--soft);
}
.info-popover--large .info-heading {
  gap: 14px;
  min-height: 56px;
  padding: 10px 18px;
  font-size: 20px;
}
.info-popover--large .info-content {
  padding: 14px 20px 16px;
}
</style>
