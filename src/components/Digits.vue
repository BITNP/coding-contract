<script setup>
defineProps({ value: [String, Number] })
</script>

<template>
  <span class="num"
    ><span v-for="(char, index) in String(value)" :key="index" :class="{ digit: char >= '0' && char <= '9' }">{{
      char
    }}</span></span
  >
</template>
