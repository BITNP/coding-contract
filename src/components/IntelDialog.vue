<script setup>
import { computed } from 'vue'
import { contractById, pointsOf } from '../../shared/contracts.js'
import { best } from '../state.js'
import GameDialog from './GameDialog.vue'
import MarkdownContent from './MarkdownContent.vue'

const props = defineProps({ ids: Array, question: Object })
const show = defineModel('show')
const selected = computed(() => props.ids.map((id) => contractById[id]))
</script>

<template>
  <GameDialog v-model:show="show" title="综合情报">
    <div class="intel-stats">
      <div><strong>{{ selected.length }}</strong><span>已选指标</span></div>
      <div><strong>{{ pointsOf(ids) }}</strong><span>指标总计</span></div>
      <div><strong>{{ best }}</strong><span>最高纪录</span></div>
    </div>
    <section v-if="question" class="dialog-section intel-question">
      <h3>{{ question.title }}</h3>
      <MarkdownContent :content="question.content" />
    </section>
    <div v-else v-scroll-fade class="intel-list">
      <p v-for="item in selected" :key="item.id">
        <b>{{ item.name }}</b><span>{{ item.description }}</span>
      </p>
    </div>
  </GameDialog>
</template>
