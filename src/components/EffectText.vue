<script setup>
import { computed } from 'vue'
const props = defineProps({ text: String })
const parts = computed(() => props.text.split(/(\d+(?:\.\d+)?(?:\s*(?:MiB|GiB|B|%))?)/g))
</script>

<template>
  <template v-for="(part, index) in parts" :key="index"><span v-if="index % 2" class="effect-number">{{ part }}</span><template v-else>{{ part }}</template></template>
</template>

<style scoped>
.effect-number { color: #e0ad2a; font-family: var(--font-num); font-size: 1.06em; padding: 0 .08em }
</style>
