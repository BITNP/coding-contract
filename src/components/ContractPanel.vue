<script setup>
import { ref, computed } from 'vue'
import { NInput, useMessage } from 'naive-ui'
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
import {
  contractById,
  pointsOf,
  pruneUnavailable,
  selectionErrors,
  toggleIndicator,
} from '../../shared/contracts.js'
import { languageById, languages } from '../../shared/languages.js'
import { best } from '../state.js'
import UiButton from './UiButton.vue'
import UiMenu from './UiMenu.vue'
import Halftone from './Halftone.vue'
import ContractBoard from './ContractBoard.vue'
import EffectText from './EffectText.vue'
import GameDialog from './GameDialog.vue'
import IntelDialog from './IntelDialog.vue'
import Digits from './Digits.vue'

const props = defineProps({
  title: { type: String, default: '选择指标' },
  ids: Array,
  language: String,
  lockFixed: Boolean,
  starting: Boolean,
  resume: Boolean,
  question: Object,
})
const emit = defineEmits(['change', 'start'])
const message = useMessage()
const pad = (value) => String(value).padStart(2, '0')

const selected = computed(() => props.ids.map((id) => contractById[id]))
const score = computed(() => pointsOf(props.ids))
const manualCount = computed(
  () => selected.value.filter((item) => item.verification === 'manual').length,
)
const keyActive = computed(() => selected.value.some((item) => item.key))
const change = (ids, language = props.language) => emit('change', ids, language)

const languageOptions = languages.map((item) => ({ label: item.name, key: item.id }))
const languageName = computed(() => languageById[props.language].name)
function changeLanguage(language) {
  const next = pruneUnavailable(props.ids, language)
  change(next, language)
  const removed = props.ids.length - next.length
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

const shareOpen = ref(false)
const intelOpen = ref(false)
const shareCode = ref('')
const selectionCode = computed(() => `PIONEER:${props.language}:${props.ids.join(',')}`)
function openShare() {
  shareCode.value = ''
  shareOpen.value = true
}
async function copyCode() {
  try {
    await navigator.clipboard.writeText(selectionCode.value)
    message.success('分享码已复制')
  } catch {
    message.info('复制失败，请手动复制分享码')
  }
}
function importCode() {
  const parts = shareCode.value.trim().split(':')
  if (parts.length !== 3 || parts[0] !== 'PIONEER') return message.warning('分享码无效，请检查后重试')
  const [, language, list] = parts
  const ids = list ? list.split(',') : []
  const errors = selectionErrors(ids, language)
  if (errors.length) return message.warning(errors.join('；'))
  change(ids, language)
  shareOpen.value = false
  message.success('指标已导入')
}
</script>

<template>
  <div class="contract-panel">
    <section class="workspace-title">
      <div class="title-lockup">
        <img class="industry-watermark" src="/assets/endfield.svg" alt="" />
        <span class="section-marker" />
        <div>
          <h1>{{ title }}<img class="cc-mark" src="/assets/cc-mark.webp" alt="" /></h1>
          <div class="title-decoration">▲ ▲ ▲ ▲<span /></div>
        </div>
      </div>

      <div class="workspace-tools">
        <UiMenu v-slot="{ toggle }" :options="languageOptions" :disabled="starting" @select="changeLanguage">
          <UiButton kind="dark" :disabled="starting" :aria-label="`编程语言：${languageName}`" @click="toggle">
            <Code2 :size="18" />{{ languageName }}<ChevronDown class="menu-chevron" :size="16" />
          </UiButton>
        </UiMenu>
        <UiButton @click="openShare">导入与分享<Download :size="18" /></UiButton>
      </div>

      <UiMenu v-slot="{ toggle }" :options="sortOptions" @select="sort = $event">
        <div class="sort-tools">
          <button class="sort-select" aria-label="选择指标排序方式" @click="toggle">
            {{ sortLabel }}<ChevronDown class="menu-chevron" :size="18" />
          </button>
          <button
            class="sort-direction"
            :aria-label="descending ? '切换为升序' : '切换为降序'"
            @click="descending = !descending"
          >
            {{ descending ? '降序' : '升序' }}
            <component :is="descending ? ArrowDownWideNarrow : ArrowUpWideNarrow" :size="18" />
          </button>
        </div>
      </UiMenu>
    </section>

    <section class="workbench">
      <ContractBoard :ids="ids" :language="language" :lock-fixed="lockFixed" @update:ids="change" />

      <aside class="selected-panel">
        <TransitionGroup v-scroll-fade name="selected-list" tag="div" class="selected-list">
          <article v-for="item in list" :key="item.id" class="selected-item">
            <div class="selected-symbol">
              <span class="level-badge" :data-level="item.level"
                >{{ item.level }}<img src="/assets/risk-level.webp" alt=""
              /></span>
              <img :src="item.icon" alt="" class="selected-icon" />
            </div>
            <div class="selected-copy">
              <h3>
                {{ item.name
                }}<span v-if="item.verification === 'manual'" class="referee-badge">需线下核验</span>
              </h3>
              <p><EffectText :text="item.description" /></p>
            </div>
            <button
              class="remove-indicator"
              :disabled="lockFixed && item.fixed"
              :aria-label="`移除${item.name}`"
              :title="`移除${item.name}`"
              @click="change(toggleIndicator(ids, item.id, language))"
            >
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
          <span v-if="manualCount" class="referee-count">含 {{ manualCount }} 项需裁判核验</span>
          <span v-if="keyActive" class="key-active"><LockOpen :size="14" />锁闭指标已激活</span>
        </div>
      </aside>
    </section>

    <footer class="operation-footer">
      <Halftone
        class="footer-halftone"
        color="#0402034d"
        :cell="5"
        :size="1.05"
        :origin="[0.8, 1]"
        :radius="0.45"
        :gamma="1.6"
      />
      <div class="record-block">
        <img src="/assets/risk-level.webp" alt="" />
        <div><strong><Digits :value="pad(best)" /></strong><span>最高纪录</span></div>
      </div>
      <span class="footer-divider" />
      <UiButton kind="dark" class="intel-button" @click="intelOpen = true">
        <Crosshair :size="24" />综合情报<ArrowUpRight :size="16" />
      </UiButton>

      <div class="operation-action">
        <div class="difficulty-note" :class="{ danger: score >= 18 }">
          <TriangleAlert :size="30" />
          <span>{{ difficulty[0] }}<small>{{ difficulty[1] }}</small></span>
        </div>
        <div class="current-score">
          <Halftone class="score-halftone" color="#8a2400" :cell="5" :angle="90" :from="0.15" />
          <motion.strong
            :key="score"
            :initial="{ opacity: 0.5, y: 8 }"
            :animate="{ opacity: 1, y: 0 }"
            :transition="{ duration: 0.18 }"
          >
            <Digits :value="pad(score)" />
          </motion.strong>
          <img src="/assets/risk-level.webp" alt="指标总计" />
        </div>
        <button
          class="start-button"
          :class="{ starting, resume }"
          :disabled="starting"
          :aria-busy="starting"
          @click="emit('start')"
        >
          <Halftone class="start-halftone" color="#640016" :cell="5" :angle="270" :from="0.35" />
          <span class="start-track" aria-hidden="true" />
          <img class="contract-emblem" src="/assets/contract-emblem.webp" alt="" />
          <span class="start-copy">
            <strong class="start-title">{{ lockFixed ? '返回作战' : resume ? '继续作战' : '行动开始' }}</strong>
            <span class="start-meta">
              {{ lockFixed || resume ? 'OPERATION CONTINUE' : 'OPERATION START' }}
              <span class="start-chevrons" aria-hidden="true"
                ><ChevronRight v-for="step in 3" :key="step" :size="15" :stroke-width="3"
              /></span>
            </span>
          </span>
        </button>
      </div>
    </footer>

    <GameDialog v-model:show="shareOpen" title="指标导入与分享">
      <section class="dialog-section">
        <h3><Share2 :size="18" />生成分享码</h3>
        <div class="share-row">
          <div class="share-total">
            <strong>{{ score }}</strong><span>指标总计</span>
          </div>
          <code class="share-code" :title="selectionCode">{{ selectionCode }}</code>
          <UiButton kind="primary" @click="copyCode">复制<Copy :size="16" /></UiButton>
        </div>
      </section>
      <section class="dialog-section">
        <h3><Download :size="18" />导入分享码</h3>
        <div class="share-row">
          <span>可粘贴并导入所获得的分享码</span>
          <NInput v-model:value="shareCode" placeholder="请输入或粘贴分享码" clearable @keyup.enter="importCode" />
          <UiButton kind="dark" @click="importCode">导入<ArrowRight :size="16" /></UiButton>
        </div>
      </section>
    </GameDialog>
    <IntelDialog v-model:show="intelOpen" :ids="ids" :question="question" />
  </div>
</template>

<style src="../views/contracts.css" />
