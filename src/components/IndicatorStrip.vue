<script setup>
import { computed } from 'vue'
import { contractById } from '../../shared/contracts.js'
import IndicatorPopover from './IndicatorPopover.vue'

const props = defineProps({ ids: Array, placement: { type: String, default: 'bottom' } })
const items = computed(() => props.ids.map((id) => contractById[id]))
</script>

<template>
  <div class="indicator-strip">
    <IndicatorPopover v-for="item in items" :key="item.id" :item="item" :placement="placement">
      <span :data-level="item.level"><img :src="item.icon" :alt="item.name" /></span>
    </IndicatorPopover>
    <small v-if="!items.length">未选指标</small>
  </div>
</template>

<style scoped>
.indicator-strip {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
span {
  display: grid;
  place-items: center;
  width: var(--indicator-size, 28px);
  height: var(--indicator-size, 28px);
  background: #121314;
  border-bottom: 2px solid #ffab34;
  cursor: help;
}
span[data-level='2'] {
  border-color: #b664f5;
}
span[data-level='3'] {
  border-color: #f4486d;
}
img {
  width: 72%;
  height: 72%;
  object-fit: contain;
}
small {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}
</style>
