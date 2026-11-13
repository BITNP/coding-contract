<script setup>
import { computed } from 'vue'
import { Ban, RotateCw, Server } from 'lucide-vue-next'
import { lspStatus, retryLanguageService } from '../lsp/index.js'

const radius = 12
const circumference = 2 * Math.PI * radius
const status = lspStatus
const labels = {
  loading: () => `代码提示下载中 ${Math.round(status.value.progress * 100)}%`,
  ready: () => '代码提示已就绪',
  error: () => `代码提示加载失败，点击重试${status.value.message ? `：${status.value.message}` : ''}`,
  unsupported: () => '当前浏览器不支持该语言的代码提示',
}
const label = computed(() => labels[status.value.state]?.())
const offset = computed(() => circumference * (1 - (status.value.state === 'loading' ? status.value.progress : 1)))
</script>

<template>
  <Transition name="lsp-status">
    <button
      v-if="label"
      class="lsp-status"
      :class="status.state"
      type="button"
      :title="label"
      :aria-label="label"
      :aria-disabled="status.state !== 'error'"
      @click="retryLanguageService"
    >
      <svg class="ring" viewBox="0 0 32 32" aria-hidden="true">
        <circle class="track" cx="16" cy="16" :r="radius" />
        <circle class="arc" cx="16" cy="16" :r="radius" :stroke-dasharray="circumference" :stroke-dashoffset="offset" />
      </svg>
      <Transition name="lsp-icon" mode="out-in">
        <RotateCw v-if="status.state === 'error'" key="retry" :size="12" :stroke-width="2.5" />
        <Server v-else-if="status.state === 'ready'" key="ready" :size="12" :stroke-width="2.25" />
        <Ban v-else-if="status.state === 'unsupported'" key="unsupported" :size="12" :stroke-width="2.25" />
      </Transition>
    </button>
  </Transition>
</template>

<style scoped>
.lsp-status {
  position: relative; display: grid; place-items: center; width: 32px; height: 32px; padding: 0; flex: none;
  border: 0; border-radius: 50%; background: none; color: var(--text); cursor: default;
}
.lsp-status > * { grid-area: 1 / 1 }
.ring { width: 32px; height: 32px; transform: rotate(-90deg) }
.lsp-status circle { fill: none; stroke-width: 2 }
.track { stroke: #ffffff1f }
.arc { stroke: currentColor; stroke-linecap: round; transition: stroke-dashoffset .3s ease, stroke .2s }
.lsp-status.error { color: var(--gold); cursor: pointer }
.lsp-status.error:hover { filter: brightness(1.15) }
.lsp-status.error .track { stroke: #efb81133 }
.lsp-status.unsupported { color: var(--muted) }
.lsp-status.ready .ring { filter: drop-shadow(0 0 4px #ffffff55) }
.lsp-status-enter-active, .lsp-status-leave-active, .lsp-icon-enter-active, .lsp-icon-leave-active { transition: opacity .2s, transform .2s }
.lsp-status-enter-from, .lsp-status-leave-to { opacity: 0 }
.lsp-icon-enter-from, .lsp-icon-leave-to { opacity: 0; transform: scale(.6) }
</style>
