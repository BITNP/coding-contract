<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NConfigProvider, NMessageProvider, darkTheme } from 'naive-ui'
import { CircleHelp, UserRound, ArrowUpRight, LogOut, Gavel } from 'lucide-vue-next'
import { themeOverrides } from './theme'
import { refreshSession, user, authAvailable, isReferee, connection } from './state'
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
    text: '作战全程保持全屏，开局即开始计时。「环境：时限」和「环境：感官遮蔽」开局后锁定，其他指标可在「编辑指标」中调整。',
  },
  {
    title: '三选一',
    text: '从「最长升温」「迷宫寻路」「信道排班」中任选一道提交。通过前可自由切题，草稿按题目和编程语言分别保存在本机。',
  },
  {
    title: '线下核验',
    text: '含「古法编程」等需现场核验的条款时，可请裁判在裁判端接入并配对；未配对时，这些条款及其依赖条款不计入有效成绩。配对后仍需裁判确认成绩。',
  },
  {
    title: '结算',
    text: '任一题通过评测并满足所选指标即结束作战，得分为所选指标的等级之和。上榜取个人最高分，分数相同用时短者优先。',
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
            <UiButton v-if="isReferee" kind="ghost" @click="router.push('/referee')"
              ><Gavel :size="21" /><span>裁判台</span></UiButton
            >
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
