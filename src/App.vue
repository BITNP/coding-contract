<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NConfigProvider, NMessageProvider, NModal, NInput, NForm, NFormItem, darkTheme } from 'naive-ui'
import { ArrowLeft, Maximize, Minimize, CircleHelp, UserRound, ArrowUpRight, LogOut } from 'lucide-vue-next'
import { themeOverrides } from './theme'
import { refreshSession, user, authAvailable, connection } from './state'
import { api } from './api'
import UiButton from './components/UiButton.vue'
import SweepOverlay from './components/SweepOverlay.vue'

const route = useRoute()
const router = useRouter()
const inOperation = computed(() => route.path.startsWith('/operation/'))
const loginOpen = ref(false)
const helpOpen = ref(false)
const username = ref('')
const password = ref('')
const loginError = ref('')
const loading = ref(false)
const fullscreen = ref(false)
const helpSteps = [
  {
    title: '选择指标',
    text: '点击卡片选入指标，再次点击取消选择。同组指标互相冲突，选入新等级会替换原有等级。',
  },
  {
    title: '锁闭指标',
    text: '选入金色锁闭指标后，带锁标记的指标随之开放；移除锁闭指标时，依赖它的指标会一并移除。',
  },
  {
    title: '行动开始',
    text: '确认指标后点击「行动开始」进入作战，阅读题目并提交代码。已选指标会保留，可随时返回调整。',
  },
]
function syncFullscreen() {
  fullscreen.value = Boolean(document.fullscreenElement)
}
onMounted(() => {
  refreshSession()
  syncFullscreen()
  document.addEventListener('fullscreenchange', syncFullscreen)
})
onBeforeUnmount(() => document.removeEventListener('fullscreenchange', syncFullscreen))

async function signIn() {
  loading.value = true
  loginError.value = ''
  try {
    await api.login({ username: username.value, password: password.value })
    await refreshSession()
    password.value = ''
    loginOpen.value = false
  } catch (error) {
    loginError.value = error.message
  } finally {
    loading.value = false
  }
}
async function signOut() {
  await api.logout()
  await refreshSession()
  loginOpen.value = false
  router.push('/')
}
async function toggleFullscreen() {
  if (document.fullscreenElement) await document.exitFullscreen()
  else await document.documentElement.requestFullscreen()
}
</script>

<template>
  <NConfigProvider :theme="darkTheme" :theme-overrides="themeOverrides">
    <NMessageProvider>
      <div class="app-shell">
        <header class="app-header">
          <a
            class="brand"
            href="/"
            :aria-label="inOperation ? '返回指标选择' : '网协合约'"
            @click.prevent="router.push('/')"
          >
            <ArrowLeft v-if="inOperation" :size="20" />
            <span v-else class="brand-slashes">//</span>
            {{ inOperation ? '作战终端' : '网协合约'
            }}<span v-if="!inOperation" class="brand-event">开拓测试作战</span>
          </a>
          <div class="header-actions">
            <span v-if="connection === 'offline'" class="connection"><i />连接中断</span>
            <UiButton
              kind="ghost"
              icon-only
              :aria-label="fullscreen ? '退出全屏' : '进入全屏'"
              @click="toggleFullscreen"
              ><component :is="fullscreen ? Minimize : Maximize" :size="21"
            /></UiButton>
            <UiButton kind="ghost" icon-only aria-label="作战指引" @click="helpOpen = true"
              ><CircleHelp :size="23"
            /></UiButton>
            <UiButton kind="ghost" @click="loginOpen = true"
              ><UserRound :size="22" /><span>{{ user?.name || '访客' }}</span></UiButton
            >
          </div>
        </header>
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in"><component :is="Component" :key="route.path" /></Transition>
        </RouterView>
      </div>
      <NModal
        v-model:show="loginOpen"
        preset="card"
        class="game-modal"
        title="管理员登录"
        :bordered="false"
        style="width: 420px"
      >
        <div class="modal-kicker">IDENTITY AUTHORIZATION</div>
        <template v-if="user"
          ><p>当前账号：{{ user.name }}</p>
          <UiButton kind="dark" @click="signOut"><LogOut :size="16" />退出登录</UiButton></template
        >
        <template v-else>
          <NForm @submit.prevent="signIn">
            <NFormItem label="账号"
              ><NInput
                v-model:value="username"
                placeholder="输入账号"
                autocomplete="username"
                :disabled="!authAvailable"
            /></NFormItem>
            <NFormItem label="密码"
              ><NInput
                v-model:value="password"
                type="password"
                show-password-on="click"
                placeholder="输入密码"
                autocomplete="current-password"
                :disabled="!authAvailable"
            /></NFormItem>
            <p v-if="loginError" class="error-text">{{ loginError }}</p>
            <p v-if="!authAvailable" class="muted">账号服务暂未开放，可先以访客身份参与作战。</p>
            <UiButton v-if="authAvailable" kind="primary" block attr-type="submit" :loading="loading"
              >登录并继续<ArrowUpRight :size="18"
            /></UiButton>
            <UiButton v-else kind="primary" block @click="loginOpen = false"
              >访客体验<ArrowUpRight :size="18"
            /></UiButton>
          </NForm>
        </template>
      </NModal>
      <NModal
        v-model:show="helpOpen"
        preset="card"
        class="game-modal"
        title="作战指引"
        :bordered="false"
        style="width: 560px"
      >
        <div class="modal-kicker">OPERATION MANUAL / 01</div>
        <div v-for="(step, index) in helpSteps" :key="step.title" class="help-step">
          <b>{{ String(index + 1).padStart(2, '0') }}</b>
          <div>
            <h3>{{ step.title }}</h3>
            <p>{{ step.text }}</p>
          </div>
        </div>
      </NModal>
      <SweepOverlay />
    </NMessageProvider>
  </NConfigProvider>
</template>
