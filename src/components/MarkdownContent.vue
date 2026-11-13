<script setup>
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import { katex } from '@mdit/plugin-katex'
import 'katex/dist/katex.min.css'

const props = defineProps({ content: { type: String, default: '' } })
const markdown = new MarkdownIt({ html: false }).use(katex, { throwOnError: false })
const html = computed(() => markdown.render(props.content))
</script>

<template>
  <div class="problem-markdown" v-html="html" />
</template>

<style scoped>
.problem-markdown { color: var(--soft); font-size: 15px; line-height: 1.8; overflow-wrap: anywhere }
.problem-markdown :deep(h1), .problem-markdown :deep(h2), .problem-markdown :deep(h3) { color: var(--text); font-size: 16px; font-weight: 500; margin: 22px 0 8px; line-height: 1.5 }
.problem-markdown :deep(h2)::before { content: ''; display: inline-block; width: 3px; height: 12px; background: var(--orange); margin-right: 10px }
.problem-markdown :deep(> :first-child) { margin-top: 0 }
.problem-markdown :deep(p), .problem-markdown :deep(ul), .problem-markdown :deep(ol) { margin: 8px 0 }
.problem-markdown :deep(pre) { margin: 8px 0; padding: 9px 12px; background: #141517; border: 1px solid #ffffff10; border-left: 2px solid #5d5e60; border-radius: 2px; overflow-x: auto; line-height: 1.7 }
.problem-markdown :deep(code) { font-family: var(--mono); font-size: 13px; background: #ffffff07; padding: 2px 5px; color: #f0c79a }
.problem-markdown :deep(pre code) { padding: 0; background: none; color: var(--text) }
.problem-markdown :deep(blockquote) { margin: 16px 0; border-left: 2px solid var(--orange); padding: 1px 16px; background: #ffffff03 }
.problem-markdown :deep(table) { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; margin: 16px 0 }
.problem-markdown :deep(th), .problem-markdown :deep(td) { border: 1px solid #ffffff18; padding: 7px 14px }
.problem-markdown :deep(a) { color: #ff9a5c; text-decoration: underline; text-underline-offset: 3px }
.problem-markdown :deep(img) { max-width: 100% }
.problem-markdown :deep(.katex) { font-size: 1.12em; color: var(--text) }
.problem-markdown :deep(.katex-display) { overflow-x: auto; overflow-y: hidden; padding: 6px; margin: 10px 0; background: linear-gradient(90deg, #ffffff04, #ffffff02, transparent) }
</style>
