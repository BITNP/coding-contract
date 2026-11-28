<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import {
  automaticPoints,
  contractById,
  manualContracts,
  pointsOf,
  requiresReferee,
} from '../../shared/contracts.js'
import { selectedIds, selectedLanguage, setSelection, user, authAvailable } from '../state'
import { api } from '../api'
import { sweep } from '../sweep'
import ContractPanel from '../components/ContractPanel.vue'
import GameDialog from '../components/GameDialog.vue'
import UiButton from '../components/UiButton.vue'

const router = useRouter()
const message = useMessage()
const starting = ref(false)
const resume = ref(null)
const refereePrompt = ref(false)
const needsReferee = computed(() => requiresReferee(selectedIds.value))
const refereeNames = computed(() =>
  manualContracts(selectedIds.value).map((id) => contractById[id].name),
)
const total = computed(() => pointsOf(selectedIds.value))
const automatic = computed(() => automaticPoints(selectedIds.value))
onMounted(() =>
  api.current().then(
    (current) => (resume.value = current.id),
    () => {},
  ),
)

function start() {
  if (authAvailable.value && !user.value) return api.login('/')
  if (needsReferee.value) {
    refereePrompt.value = true
    return
  }
  begin(false)
}

async function begin(pairing) {
  refereePrompt.value = false
  document.documentElement.requestFullscreen?.().catch(() => {})
  if (starting.value) return
  starting.value = true
  try {
    const operation = await api.start(selectedIds.value, selectedLanguage.value)
    const query = pairing ? { pair: '1' } : {}
    await sweep(() => router.push({ path: `/operation/${operation.id}`, query }))
  } catch (error) {
    message.error(error.message)
  } finally {
    starting.value = false
  }
}
</script>

<template>
  <main class="contracts-view">
    <ContractPanel
      :ids="selectedIds"
      :language="selectedLanguage"
      :starting="starting"
      :resume="Boolean(resume)"
      @change="setSelection"
      @start="start"
    />

    <GameDialog v-model:show="refereePrompt" title="本场作战含线下核验条款" :width="540">
      <div class="referee-intro">
        <p>
          所选指标中的
          <b v-for="name in refereeNames" :key="name">「{{ name }}」</b>
          无法由评测机判断，需要现场裁判核验。
        </p>
        <p>
          请找到现场裁判，在裁判端接入你的作战完成配对（作战页会显示配对码）。一名裁判可以同时监督多名参赛者。
          开始后计时立即开始，配对可在作战过程中完成。
        </p>
        <p class="referee-warning">
          也可以不配对直接开始。但未核验条款<strong>以及依赖它们的条款</strong>都不计入有效成绩：
        </p>
        <div class="referee-scores">
          <div><strong>{{ automatic }}</strong><span>未配对时的有效成绩</span></div>
          <div><strong>{{ total }}</strong><span>所选成绩</span></div>
        </div>
      </div>
      <template #actions>
        <UiButton kind="dark" @click="begin(false)">不配对，直接开始</UiButton>
        <UiButton kind="primary" @click="begin(true)">开始并寻找裁判</UiButton>
      </template>
    </GameDialog>
  </main>
</template>

<style scoped>
.referee-intro p {
  margin-bottom: 14px;
  line-height: 1.8;
  color: #c7c8cc;
}
.referee-intro b {
  font-weight: 500;
  color: var(--text);
}
.referee-warning strong {
  font-weight: 500;
  color: #ff8b9e;
}
.referee-scores {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 16px;
  background: #1b1c20;
  text-align: center;
}
.referee-scores strong {
  display: block;
  font: 400 36px/1.2 var(--font-num);
}
.referee-scores span {
  font-size: 13px;
  color: var(--muted);
}
</style>
