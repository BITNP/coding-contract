<script setup>
import { NModal } from 'naive-ui'
import { X } from 'lucide-vue-next'
defineProps({ title: String, width: { type: Number, default: 640 }, closable: { type: Boolean, default: true } })
const show = defineModel('show', { type: Boolean })
</script>

<template>
  <NModal v-model:show="show" :mask-closable="closable" :close-on-esc="closable" :auto-focus="false">
    <div class="game-dialog" role="dialog" :aria-label="title" :style="{ width: `${width}px` }">
      <header class="game-dialog-heading">
        <h2>{{ title }}</h2>
        <button v-if="closable" type="button" class="game-dialog-close" aria-label="关闭" @click="show = false">
          <X :size="26" :stroke-width="1.5" />
        </button>
      </header>
      <div class="game-dialog-body"><slot /></div>
      <footer v-if="$slots.actions" class="game-dialog-actions"><slot name="actions" /></footer>
    </div>
  </NModal>
</template>
