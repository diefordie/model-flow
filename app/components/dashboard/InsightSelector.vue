<script setup lang="ts">
/**
 * InsightSelector — picker for available insights per project.
 *
 * Per PRD §07 §5: insights grouped by category; compatibility flagged
 * from backend (the `available` field on InsightDescriptor). We don't
 * hard-code task compatibility here — `listInsights(projectId, taskType)`
 * returns only compatible ones anyway.
 */
import type { InsightDescriptor } from '~/types/api'

const props = defineProps<{
  insights: InsightDescriptor[]
}>()
const emit = defineEmits<{ (e: 'select', insight: InsightDescriptor): void }>()

const grouped = computed(() => {
  const map: Record<string, InsightDescriptor[]> = {}
  for (const i of props.insights) {
    map[i.category] = map[i.category] ?? []
    map[i.category].push(i)
  }
  return map
})

const categoryLabel = (c: string) => ({
  dataset: 'Dataset',
  eda: 'Exploratory',
  ml: 'Machine learning',
  model_metrics: 'Model metrics'
})[c] ?? c
</script>

<template>
  <div v-if="!insights.length" class="text-sm text-ink-500 italic">No insights available yet.</div>
  <div v-else class="space-y-4">
    <div v-for="(items, cat) in grouped" :key="cat">
      <h4 class="text-[10px] font-mono uppercase tracking-wider text-ink-400 mb-1.5">{{ categoryLabel(cat) }}</h4>
      <div class="space-y-1">
        <button
          v-for="i in items"
          :key="i.key"
          @click="emit('select', i)"
          :disabled="!i.available"
          class="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-ink-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ i.label }}
        </button>
      </div>
    </div>
  </div>
</template>