<script setup>
import InfoPopover from './InfoPopover.vue'
import EffectText from './EffectText.vue'
defineProps({ item: Object, placement: { type: String, default: 'right' } })
</script>

<template>
  <InfoPopover :placement="placement" accent="var(--orange)" :width="330" large>
    <template #trigger><slot /></template>
    <template #heading><img class="popover-icon" :src="item.icon" alt="" /><strong>{{ item.name }}</strong></template>
    <span class="level-badge" :data-level="item.level">{{ item.level }}<img src="/assets/risk-level.webp" alt="指标" /></span>
    <p><EffectText :text="item.description" /></p>
    <slot name="hint" />
  </InfoPopover>
</template>

<style scoped>
strong { font-weight: 400 }
.popover-icon { width: 44px; height: 44px; filter: drop-shadow(0 3px 0 #0004) }
p { margin: 12px 0 14px; font-size: 15px; line-height: 1.65; color: var(--soft) }
:slotted(small) { display: flex; align-items: center; gap: 6px; font-size: var(--fs-caption); color: var(--muted) }
</style>
