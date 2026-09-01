<script setup lang="ts">
/**
 * MetricCard — single labeled number with optional sublabel and trend.
 *
 * Used in experiment detail to display Accuracy / F1 / MAE / R² etc.
 * Highlights the primary metric when `primary` is true.
 */
const props = defineProps<{
  label: string
  value: string | number
  unit?: string
  sublabel?: string
  primary?: boolean
}>()

const formatted = computed(() => {
  if (typeof props.value === 'number') {
    if (props.value >= 1000) return props.value.toLocaleString()
    return Number.isInteger(props.value) ? props.value.toString() : props.value.toFixed(3)
  }
  return props.value
})
</script>

<template>
  <div :class="[
    'p-4 rounded-lg border',
    primary ? 'border-accent bg-accent-50/30' : 'border-ink-200 bg-white'
  ]">
    <div class="text-[10px] font-mono uppercase tracking-wider text-ink-500">
      {{ label }}
      <span v-if="primary" class="text-accent">· primary</span>
    </div>
    <div class="mt-1 flex items-baseline gap-1">
      <span :class="['text-2xl font-semibold tabular-nums', primary ? 'text-accent' : 'text-ink-900']">
        {{ formatted }}
      </span>
      <span v-if="unit" class="text-xs text-ink-500">{{ unit }}</span>
    </div>
    <div v-if="sublabel" class="text-[11px] text-ink-500 mt-1">{{ sublabel }}</div>
  </div>
</template>