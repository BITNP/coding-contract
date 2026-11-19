<script setup>
import { phaseLabels } from '../../shared/labels.js'
import InfoPopover from './InfoPopover.vue'
defineProps({ round: Object, placement: { type: String, default: 'bottom' } })
</script>

<template>
  <InfoPopover :placement="placement" :width="260">
    <template #trigger>
      <slot>
        <div class="round-line" :class="round.phase">
          <i>{{ round.mark }}</i>
          <span><img v-for="item in round.items" :key="item.id" :src="item.icon" alt="" /></span>
          <b class="num">{{ round.phase === 'passed' ? round.score : '—' }}</b>
        </div>
      </slot>
    </template>
    <template #heading
      ><span class="mark">{{ round.mark }}</span
      >{{ round.title || (round.phase === 'pending' ? '尚未开放' : '未选题') }}</template
    >
    <p>
      {{ phaseLabels[round.phase] }}<template v-if="round.phase === 'passed'"> · 获得 {{ round.score }} 分</template>
    </p>
    <ul v-if="round.items.length">
      <li v-for="item in round.items" :key="item.id"><img :src="item.icon" alt="" />{{ item.name }}</li>
    </ul>
  </InfoPopover>
</template>

<style scoped>
.mark {
  font-family: var(--font-num);
}
p {
  color: var(--soft);
}
ul {
  display: grid;
  gap: 6px;
  margin: 10px 0 0;
  padding: 10px 0 0;
  border-top: 1px solid #ffffff12;
  list-style: none;
}
li {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
}
img {
  width: 20px;
  height: 20px;
}
.round-line {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: subgrid;
  align-items: center;
  height: var(--line);
  cursor: help;
}
.round-line i {
  display: grid;
  place-items: center;
  width: calc(var(--line) * 1.4);
  height: var(--line);
  clip-path: polygon(22% 0, 78% 0, 100% 50%, 78% 100%, 22% 100%, 0 50%);
  background: #ffffff14;
  font: normal calc(var(--line) * 0.62) / 1 var(--font-num);
  color: var(--muted);
}
.round-line span {
  display: flex;
  gap: calc(var(--line) * 0.2);
  min-width: 0;
  overflow: hidden;
}
.round-line img {
  flex: none;
  width: var(--line);
  height: var(--line);
  opacity: 0.4;
}
.round-line b {
  min-width: calc(var(--line) * 1.2);
  font-size: calc(var(--line) * 1.05);
  font-weight: 400;
  line-height: 1;
  text-align: right;
  color: #5d5e60;
}
.round-line.passed i {
  background: #b9cf8a33;
  color: var(--green);
}
.round-line.passed img {
  opacity: 0.9;
}
.round-line.passed b {
  color: var(--text);
}
</style>
