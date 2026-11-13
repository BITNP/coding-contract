import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import ContractsView from './views/ContractsView.vue'
import './style.css'
import { palette } from './theme'
import { vScrollFade } from './scrollFade'

for (const [key, value] of Object.entries(palette))
  document.documentElement.style.setProperty(`--${key}`, value)

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: ContractsView },
    { path: '/operation/:id', component: () => import('./views/OperationView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
createApp(App).use(router).directive('scroll-fade', vScrollFade).mount('#app')
