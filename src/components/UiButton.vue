<script setup>
import { NButton } from 'naive-ui'
import { buttonVariants } from '../theme'
defineProps({ kind: { default: 'light' }, iconOnly: Boolean })
</script>

<template>
  <NButton
    v-bind="buttonVariants[kind]"
    :quaternary="kind === 'ghost'"
    :circle="iconOnly"
    :round="!iconOnly"
    class="ui-button"
    :class="[`ui-button--${kind}`, { 'ui-button--icon': iconOnly }]"
  >
    <slot />
  </NButton>
</template>
