<script setup>
import { NPopover } from 'naive-ui'
import EffectText from './EffectText.vue'
defineProps({ item: Object, placement: { type: String, default: 'right' } })
</script>

<template>
  <NPopover trigger="hover" :placement="placement" :delay="120" :duration="80" :show-arrow="false" :keep-alive-on-hover="false">
    <template #trigger><slot /></template>
    <div class="indicator-popover">
      <div class="popover-heading"><img :src="item.icon" alt="" /><strong>{{ item.name }}</strong></div>
      <div class="popover-content">
        <span class="level-badge" :data-level="item.level">{{ item.level }}<img src="/assets/risk-level.png" alt="指标" /></span>
        <p><EffectText :text="item.description" /></p>
        <slot name="hint" />
      </div>
    </div>
  </NPopover>
</template>

<style scoped>
.indicator-popover { width: 330px; color: #e7e7e5; background: #343537; box-shadow: 0 15px 30px #0005; border-bottom: 3px solid #494a4c }
.popover-heading { display: flex; align-items: center; gap: 14px; min-height: 56px; padding: 10px 18px; background: var(--orange); font-size: 20px; letter-spacing: .02em }
.popover-heading strong { font-weight: 400 }
.popover-heading img { width: 44px; height: 44px; filter: drop-shadow(0 3px 0 #0004) }
.popover-content { padding: 14px 20px 16px }
.popover-content p { margin: 12px 0 14px; font-size: 15px; line-height: 1.65; color: var(--soft) }
.popover-content :slotted(small) { display: flex; align-items: center; gap: 6px; font-size: var(--fs-caption); color: var(--muted) }
</style>
