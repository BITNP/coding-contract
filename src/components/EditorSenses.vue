<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Ban, CodeXml, NotebookPen, RotateCw, Server } from 'lucide-vue-next'
import StatusRing from './StatusRing.vue'
import { lspStatus, retryLanguageService } from '../lsp/index.js'

const props = defineProps({ masked: { type: Number, default: 0 } })

const shown = ref(0)
let timer = 0
onMounted(() => (timer = setTimeout(() => (shown.value = props.masked), 400)))
onBeforeUnmount(() => clearTimeout(timer))
watch(
  () => props.masked,
  (level) => (shown.value = level),
)

const service = computed(() => {
  const { state, progress } = lspStatus.value
  const percent = Math.round(progress * 100)
  return {
    loading: { tone: 'loading', progress, label: `代码提示下载中 ${percent}%` },
    ready: { icon: Server, label: '代码提示已就绪' },
    error: { tone: 'error', icon: RotateCw, progress, label: '代码提示下载失败，点击重试', action: true },
    unsupported: { tone: 'off', icon: Ban, label: '当前浏览器不支持该语言的代码提示' },
    none: { tone: 'off', icon: Server, label: '当前语言暂无代码提示' },
  }[state]
})

const senses = computed(() => [
  { key: 'editor', icon: NotebookPen, label: '编辑器：等宽字体与语法着色', mask: '「感官遮蔽 III」：编辑器已退化为纯文本' },
  { key: 'aids', icon: CodeXml, label: '编辑辅助：自动补全、括号配对与折叠', mask: '「感官遮蔽 II」：编辑辅助已屏蔽' },
  { key: 'service', ...service.value, mask: '「感官遮蔽 I」：代码提示已屏蔽' },
])

const rings = computed(() =>
  senses.value.map(({ key, mask, ...ring }, index, all) => {
    const order = all.length - index
    const struck = shown.value >= order
    return {
      key,
      ring: struck ? { icon: ring.icon, label: mask, struck } : ring,
      style: { '--delay': `${(order - 1) * 0.22}s` },
    }
  }),
)
</script>

<template>
  <div class="editor-senses">
    <StatusRing
      v-for="{ key, ring, style } in rings"
      :key="key"
      v-bind="ring"
      :style="style"
      @activate="retryLanguageService"
    />
  </div>
</template>

<style scoped>
.editor-senses {
  display: flex;
  align-items: center;
  gap: 2px;
}
</style>
