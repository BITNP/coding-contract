<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { NModal, NInput, useMessage } from 'naive-ui'
import { motion } from 'motion-v'
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  ArrowUpRight,
  ArrowRight,
  Trash2,
  Download,
  Copy,
  Share2,
  TriangleAlert,
  ChevronDown,
  ChevronRight,
  Crosshair,
  Code2,
  LockOpen,
} from 'lucide-vue-next'
import { selected, selectedIds, selectedLanguage, setLanguage, score, best, toggle, setSelection, keyActive } from '../state'
import { languages } from '../../shared/languages.js'
import { api } from '../api'
import { sweep } from '../sweep'
import UiButton from '../components/UiButton.vue'
import UiMenu from '../components/UiMenu.vue'
import Halftone from '../components/Halftone.vue'
import ContractBoard from '../components/ContractBoard.vue'
import EffectText from '../components/EffectText.vue'

const router = useRouter()
const message = useMessage()
const pad = (value) => String(value).padStart(2, '0')

const languageOptions = languages.map((item) => ({ label: item.name, key: item.id }))
const languageName = computed(() => languages.find((item) => item.id === selectedLanguage.value).name)
function changeLanguage(language) {
  const before = selectedIds.value.length
  setLanguage(language)
  const removed = before - selectedIds.value.length
  if (removed) message.info(`已移除 ${removed} 项不适用于当前语言的指标`)
}

const sortOptions = [
  { label: '选入顺序', key: 'selected' },
  { label: '指标等级', key: 'level' },
  { label: '指标类别', key: 'category' },
]
const sort = ref('selected')
const descending = ref(true)
const sortLabel = computed(() => sortOptions.find((option) => option.key === sort.value).label)
const list = computed(() => {
  const items = [...selected.value]
  if (sort.value === 'level') items.sort((a, b) => a.level - b.level)
  if (sort.value === 'category') items.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  return descending.value ? items.reverse() : items
})

const difficulty = computed(() =>
  score.value >= 18
    ? ['当前指标难度极大', '请谨慎行动']
    : score.value
      ? ['当前指标难度', '确认后即可行动']
      : ['当前指标难度', '暂未选入指标'],
)

const dialog = ref('share')
const dialogOpen = ref(false)
const dialogTitles = { share: '指标导入与分享', intel: '综合情报' }
const shareCode = ref('')
const selectionCode = computed(() => `PIONEER:${selectedLanguage.value}:${selectedIds.value.join(',')}`)
function openDialog(kind) {
  if (kind === 'share') shareCode.value = ''
  dialog.value = kind
  dialogOpen.value = true
}
async function copyCode() {
  try {
    await navigator.clipboard.writeText(selectionCode.value)
    message.success('分享码已复制')
  } catch {
    message.info('复制失败，请手动复制分享码')
    if (!dialogOpen.value) openDialog('share')
  }
}
function importCode() {
  const code = shareCode.value.trim()
  if (!code.startsWith('PIONEER:')) return message.warning('分享码无效，请检查后重试')
  const parts = code.slice(8).split(':')
  const [language, ids] = parts.length === 1 ? ['cpp', parts[0]] : parts
  try {
    if (parts.length > 2) throw new Error('分享码无效，请检查后重试')
    setSelection(ids ? ids.split(',') : [], language)
  } catch (error) {
    return message.warning(error.message)
  }
  dialogOpen.value = false
  message.success('指标已导入')
}

const starting = ref(false)
async function start() {
  starting.value = true
  try {
    const operation = await api.start(selectedIds.value, selectedLanguage.value)
    await sweep(() => router.push(`/operation/${operation.id}`))
  } catch (error) {
    message.error(error.message)
  } finally {
    starting.value = false
  }
}
</script>

<template>
  <main class="contracts-view">
    <section class="workspace-title">
      <div class="title-lockup">
        <img class="industry-watermark" src="/assets/endfield.svg" alt="" />
        <span class="section-marker" />
        <div>
          <h1>选择指标<img class="cc-mark" src="/assets/cc-mark.webp" alt="" /></h1>
          <div class="title-decoration">▲ ▲ ▲ ▲<span /></div>
        </div>
      </div>

      <div class="workspace-tools">
        <UiMenu v-slot="{ toggle }" :options="languageOptions" :disabled="starting" @select="changeLanguage">
          <UiButton kind="dark" :disabled="starting" :aria-label="`编程语言：${languageName}`" @click="toggle">
            <Code2 :size="18" />{{ languageName }}<ChevronDown :size="16" />
          </UiButton>
        </UiMenu>
        <UiButton @click="openDialog('share')">导入与分享<Download :size="18" /></UiButton>
      </div>

      <UiMenu v-slot="{ toggle }" :options="sortOptions" @select="sort = $event">
        <div class="sort-tools">
          <button class="sort-select" aria-label="选择指标排序方式" @click="toggle">{{ sortLabel }}<ChevronDown :size="18" /></button>
          <button class="sort-direction" :aria-label="descending ? '切换为升序' : '切换为降序'" @click="descending = !descending">
            {{ descending ? '降序' : '升序' }}
            <component :is="descending ? ArrowDownWideNarrow : ArrowUpWideNarrow" :size="18" />
          </button>
        </div>
      </UiMenu>
    </section>

    <section class="workbench">
      <ContractBoard />

      <aside class="selected-panel">
        <TransitionGroup v-scroll-fade name="selected-list" tag="div" class="selected-list">
          <article v-for="item in list" :key="item.id" class="selected-item">
            <div class="selected-symbol">
              <span class="level-badge" :data-level="item.level">{{ item.level }}<img src="/assets/risk-level.webp" alt="" /></span>
              <img :src="item.icon" alt="" class="selected-icon" />
            </div>
            <div class="selected-copy">
              <h3>{{ item.name }}</h3>
              <p><EffectText :text="item.description" /></p>
            </div>
            <button class="remove-indicator" :aria-label="`移除${item.name}`" :title="`移除${item.name}`" @click="toggle(item)">
              <Trash2 :size="18" />
            </button>
          </article>
        </TransitionGroup>
        <div v-if="!list.length" class="empty-selection">
          <Crosshair :size="40" :stroke-width="1" />
          <h3>- 暂无指标 -</h3>
          <p>可在左侧选择指标</p>
        </div>
        <div class="selected-summary">
          <span>已选指标<b>{{ pad(selected.length) }}</b></span>
          <span v-if="keyActive" class="key-active"><LockOpen :size="14" />锁闭指标已激活</span>
        </div>
      </aside>
    </section>

    <footer class="operation-footer">
      <Halftone class="footer-halftone" color="#0402034d" :cell="5" :size="1.05" :origin="[0.8, 1]" :radius="0.45" :gamma="1.6" />
      <div class="record-block">
        <img src="/assets/risk-level.webp" alt="" />
        <div><strong>{{ pad(best) }}</strong><span>最高纪录</span></div>
      </div>
      <span class="footer-divider" />
      <UiButton kind="dark" class="intel-button" @click="openDialog('intel')">
        <Crosshair :size="24" />综合情报<ArrowUpRight :size="16" />
      </UiButton>

      <div class="operation-action">
        <div class="difficulty-note" :class="{ danger: score >= 18 }">
          <TriangleAlert :size="30" />
          <span>{{ difficulty[0] }}<small>{{ difficulty[1] }}</small></span>
        </div>
        <div class="current-score">
          <Halftone class="score-halftone" color="#8a2400" :cell="5" :angle="90" :from="0.15" />
          <motion.strong :key="score" :initial="{ opacity: 0.5, y: 8 }" :animate="{ opacity: 1, y: 0 }" :transition="{ duration: 0.18 }">
            {{ pad(score) }}
          </motion.strong>
          <img src="/assets/risk-level.webp" alt="指标总计" />
        </div>
        <button class="start-button" :class="{ starting }" :disabled="starting" :aria-busy="starting" @click="start">
          <Halftone class="start-halftone" color="#640016" :cell="5" :angle="270" :from="0.35" />
          <span class="start-track" aria-hidden="true" />
          <img class="contract-emblem" src="/assets/contract-emblem.webp" alt="" />
          <span class="start-copy">
            <strong class="start-title">行动开始</strong>
            <span class="start-meta">
              OPERATION START
              <span class="start-chevrons" aria-hidden="true"><ChevronRight v-for="step in 3" :key="step" :size="15" :stroke-width="3" /></span>
            </span>
          </span>
        </button>
      </div>
    </footer>

    <NModal
      v-model:show="dialogOpen"
      preset="card"
      class="game-modal"
      :title="dialogTitles[dialog]"
      :bordered="false"
      style="width: 600px"
    >
      <template v-if="dialog === 'share'">
        <div class="modal-kicker">CONTRACT CONFIGURATION</div>
        <section class="share-section">
          <h4><Share2 :size="16" />生成分享码</h4>
          <div class="share-row">
            <div class="share-total"><strong>{{ score }}</strong><span>指标总计</span></div>
            <code class="share-code" :title="selectionCode">{{ selectionCode }}</code>
            <UiButton kind="primary" @click="copyCode">复制<Copy :size="16" /></UiButton>
          </div>
        </section>
        <section class="share-section">
          <h4><Download :size="16" />导入分享码</h4>
          <p>可粘贴并导入所获得的分享码</p>
          <div class="share-row">
            <NInput v-model:value="shareCode" placeholder="请输入或粘贴分享码" clearable @keyup.enter="importCode" />
            <UiButton kind="dark" @click="importCode">导入<ArrowRight :size="16" /></UiButton>
          </div>
        </section>
      </template>
      <template v-else-if="dialog === 'intel'">
        <div class="modal-kicker">OPERATION INTELLIGENCE</div>
        <div class="intel-stats">
          <div><strong>{{ selected.length }}</strong><span>已选指标</span></div>
          <div><strong>{{ score }}</strong><span>指标总计</span></div>
          <div><strong>{{ best }}</strong><span>最高纪录</span></div>
        </div>
        <div v-scroll-fade class="intel-list">
          <p v-for="item in selected" :key="item.id"><b>{{ item.name }}</b><span>{{ item.description }}</span></p>
          <p v-if="!selected.length" class="muted">暂无指标</p>
        </div>
      </template>
    </NModal>
  </main>
</template>

<style src="./contracts.css" />
