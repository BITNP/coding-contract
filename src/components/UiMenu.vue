<script setup>
import { ref } from 'vue'
import { NDropdown } from 'naive-ui'

defineProps({
  options: Array,
  placement: { type: String, default: 'bottom-start' },
  maxHeight: { type: String, default: 'min(480px, 60vh)' },
  disabled: Boolean,
})
const emit = defineEmits(['select'])
const open = ref(false)
const anchor = ref(null)
const tuck = ref(20)

function toggle() {
  tuck.value = anchor.value.offsetHeight / 2
  open.value = !open.value
}
function select(key) {
  open.value = false
  emit('select', key)
}
</script>

<template>
  <NDropdown
    trigger="manual"
    :show="open && !disabled"
    :options="options"
    :placement="placement"
    width="trigger"
    :to="false"
    :z-index="10"
    scrollable
    :menu-props="() => ({ class: 'ui-menu', style: { '--tuck': `${tuck}px`, maxHeight } })"
    @select="select"
    @clickoutside="open = false"
  >
    <div ref="anchor" class="menu-anchor" :class="{ open }">
      <slot :toggle="toggle" />
    </div>
  </NDropdown>
</template>

<style>
.menu-anchor {
  position: relative;
  z-index: 11;
  display: flex;
  transition: filter 0.15s;
}
.menu-anchor.open {
  filter: drop-shadow(0 4px 10px #0006);
}
.ui-menu.n-dropdown-menu {
  margin: calc(var(--tuck) * -1) 0 0 !important;
  padding: var(--tuck) 0 0;
  border-radius: 0 0 20px 20px;
  overflow: hidden;
  background: var(--light);
  box-shadow: 0 14px 28px -10px #0008;
  transform: none !important;
  transition: opacity 0.15s ease !important;
  --n-option-text-color: #2a2b2e !important;
  --n-option-text-color-hover: #2a2b2e !important;
  --n-option-text-color-active: #2a2b2e !important;
  --n-option-color-hover: #dcdbd7 !important;
  --n-option-color-active: #dcdbd7 !important;
}
.ui-menu .n-dropdown-option + .n-dropdown-option {
  border-top: 1px solid #0000001a;
}
.ui-menu .n-dropdown-option-body {
  height: 44px !important;
  padding: 0 20px !important;
  font-size: 16px !important;
  letter-spacing: 0.02em;
}
.ui-menu .n-dropdown-option-body::before {
  left: 0;
  right: 0;
  border-radius: 0;
}
.ui-menu .n-dropdown-option-body__prefix,
.ui-menu .n-dropdown-option-body__suffix {
  display: none !important;
}
.ui-menu .n-dropdown-option-body__label {
  padding: 0 !important;
}
</style>
