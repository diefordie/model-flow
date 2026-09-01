<script setup lang="ts">
/**
 * FeatureImportance — horizontal bar list, sorted desc.
 *
 * For tree-based models: scaled Gini importance. For others: coefficients
 * or permutation importance (decided by backend). We just render whatever
 * the backend returns.
 */
const props = defineProps<{
  data: Array<{ name: string; importance: number }>
}>()

const max = computed(() => Math.max(...props.data.map(d => d.importance), 0.001))
</script>

<template>
  <div class="space-y-1.5">
    <div v-for="(d, i) in data" :key="d.name" class="flex items-center gap-2">
      <span class="text-[11px] font-mono text-ink-700 w-32 truncate shrink-0">{{ d.name }}</span>
      <div class="flex-1 h-5 bg-ink-100 rounded relative overflow-hidden">
        <div class="absolute inset-y-0 left-0 bg-accent rounded" :style="{ width: `${(d.importance / max) * 100}%` }" />
      </div>
      <span class="text-[11px] tabular-nums text-ink-500 w-12 text-right shrink-0">{{ (d.importance * 100).toFixed(1) }}%</span>
    </div>
  </div>
</template>