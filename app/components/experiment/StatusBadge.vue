<script setup lang="ts">
/**
 * StatusBadge — small pill that color-codes an experiment's status.
 *
 * Status colors:
 *   queued    → ink-300 / text-ink-700
 *   running   → accent + animated pulse
 *   completed → emerald-700
 *   failed    → red-700
 *   canceled  → ink-500
 */
import type { ExperimentStatus } from '~/types/api'

const props = defineProps<{ status: ExperimentStatus }>()

const styles = computed(() => {
  switch (props.status) {
    case 'queued':    return { bg: 'bg-ink-100',     text: 'text-ink-700',   dot: 'bg-ink-400' }
    case 'running':   return { bg: 'bg-accent-50',   text: 'text-accent',    dot: 'bg-accent animate-pulse-soft' }
    case 'completed': return { bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500' }
    case 'failed':    return { bg: 'bg-red-50',      text: 'text-red-700',   dot: 'bg-red-500' }
    case 'canceled':  return { bg: 'bg-ink-100',     text: 'text-ink-500',   dot: 'bg-ink-400' }
    default:          return { bg: 'bg-ink-100',     text: 'text-ink-700',   dot: 'bg-ink-400' }
  }
})
</script>

<template>
  <span :class="[styles.bg, styles.text, 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium']">
    <span :class="[styles.dot, 'w-1.5 h-1.5 rounded-full']" />
    {{ status }}
  </span>
</template>