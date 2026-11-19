<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NConfigProvider, NMessageProvider, darkTheme } from 'naive-ui'
import { CircleHelp, UserRound, ArrowUpRight, LogOut } from 'lucide-vue-next'
import { themeOverrides } from './theme'
import { refreshSession, user, authAvailable, connection } from './state'
import { api } from './api'
import UiButton from './components/UiButton.vue'
import SweepOverlay from './components/SweepOverlay.vue'
import GameDialog from './components/GameDialog.vue'

const route = useRoute()
const router = useRouter()
const inOperation = computed(() => route.path.startsWith('/operation/'))
const loginOpen = ref(false)
const helpOpen = ref(false)
const loginError = ref('')
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
    text: '所选指标即作战的初始配置。作战全程需保持全屏，时限从行动开始计时，「环境：时限」和「环境：感官遮蔽」在开局后锁定。',
  },
  {
    title: '三个回合',
    text: '第一、三回合为固定题目，第二回合三选一。作战中点击左上角的「编辑指标」即可随时调整指标，提交通过才能进入下一回合，也可以放弃本回合。',
  },
  {
    title: '结算',
    text: '成绩为各已通过回合的指标分之和。三个回合结束或时间耗尽时结算，取历史最高成绩上榜。',
  },
]
onMounted(async () => {
  refreshSession()
  await router.isReady()
  if (route.query.auth_error) {
    loginError.value = String(route.query.auth_error)
    loginOpen.value = true
    const { auth_error, ...query } = route.query
    router.replace({ path: route.path, query, hash: route.hash })
  }
})

function signIn() {
  api.login(route.fullPath)
}
async function signOut() {
  await api.logout()
  await refreshSession()
  loginOpen.value = false
  router.push('/')
}
</script>

<template>
  <NConfigProvider :theme="darkTheme" :theme-overrides="themeOverrides">
    <NMessageProvider :duration="2200" :max="3">
      <div class="app-shell">
        <header v-if="!route.meta.bare" class="app-header">
          <a v-if="!inOperation" class="brand" href="/" @click.prevent="router.push('/')">
            <span class="brand-slashes">//</span>网协合约<span class="brand-event">开拓测试作战</span>
          </a>
          <div id="header-status" class="header-status" />
          <div class="header-actions">
            <span v-if="connection === 'offline'" class="connection"><i />连接中断</span>
            <div id="header-tools" class="header-tools" />
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
      <GameDialog v-model:show="loginOpen" title="网协统一登录" :width="440">
        <template v-if="user">
          <p>当前账号：{{ user.name }}</p>
        </template>
        <template v-else>
          <p v-if="authAvailable">使用网协统一账号登录并保存个人作战记录。</p>
          <p v-else>账号服务暂未开放，可先以访客身份参与作战。</p>
          <p v-if="loginError" class="error-text">{{ loginError }}</p>
        </template>
        <template #actions>
          <UiButton v-if="user" kind="dark" @click="signOut"><LogOut :size="16" />退出登录</UiButton>
          <UiButton v-else-if="authAvailable" kind="primary" @click="signIn"
            >登录并继续<ArrowUpRight :size="18"
          /></UiButton>
          <UiButton v-else kind="primary" @click="loginOpen = false">访客体验<ArrowUpRight :size="18" /></UiButton>
        </template>
      </GameDialog>
      <GameDialog v-model:show="helpOpen" title="作战指引" :width="560">
        <div v-for="(step, index) in helpSteps" :key="step.title" class="help-step">
          <b class="num">{{ String(index + 1).padStart(2, '0') }}</b>
          <div>
            <h3>{{ step.title }}</h3>
            <p>{{ step.text }}</p>
          </div>
        </div>
      </GameDialog>
      <SweepOverlay />
    </NMessageProvider>
  </NConfigProvider>
</template>
