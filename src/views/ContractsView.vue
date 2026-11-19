<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { selectedIds, selectedLanguage, setSelection, user, authAvailable } from '../state'
import { api } from '../api'
import { sweep } from '../sweep'
import ContractPanel from '../components/ContractPanel.vue'

const router = useRouter()
const message = useMessage()
const starting = ref(false)
const resume = ref(null)
onMounted(() =>
  api.current().then(
    (current) => (resume.value = current.id),
    () => {},
  ),
)

async function start() {
  if (authAvailable.value && !user.value) return api.login('/')
  document.documentElement.requestFullscreen?.().catch(() => {})
  if (starting.value) return
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
    <ContractPanel
      :ids="selectedIds"
      :language="selectedLanguage"
      :starting="starting"
      :resume="Boolean(resume)"
      @change="setSelection"
      @start="start"
    />
  </main>
</template>
