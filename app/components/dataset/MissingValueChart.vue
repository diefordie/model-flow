<script setup lang="ts">
/**
 * MissingValueChart — horizontal bar chart of missing values per column.
 *
 * PRD §6.1: "MissingValueChart: rendered from GET /datasets/:datasetId/profile".
 *
 * SVG-based (no chart library) — matches the chart-data-rendered-on-
 * frontend pattern from `07-frontend-components-state.md` §4.
 */
import type { ColumnMeta } from '~/types/api'

const props = defineProps<{
  columns: ColumnMeta[]
  totalRows: number
}>()

const rows = computed(() => {
  return props.columns
    .map(c => ({
      name: c.name,
      count: c.missing,
      pct: props.totalRows > 0 ? (c.missing / props.totalRows) * 100 : 0
    }))
    .filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count)
})

const maxPct = computed(() => Math.max(1, ...rows.value.map(r => r.pct)))
const totalMissing = computed(() => rows.value.reduce((s, r) => s + r.count, 0))
</script>

<template>
  <section class="surface p-5">
    <header class="flex items-center justify-between mb-3">
      <div>
        <h3 class="text-sm font-semibold">Missing values</h3>
        <p class="text-xs text-ink-500 mt-0.5">
          <span v-if="rows.length === 0">No missing values detected.</span>
          <span v-else>{{ totalMissing.toLocaleString() }} missing across {{ rows.length }} columns</span>
        </p>
      </div>
      <span class="text-[11px] font-mono uppercase tracking-wider text-ink-400">{{ rows.length }} affected</span>
    </header>

    <div v-if="rows.length === 0" class="py-10 text-center text-sm text-ink-400">
      <svg viewBox="0 0 48 48" fill="none" class="w-10 h-10 mx-auto mb-2 opacity-50"><circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="1.5"/><path d="M16 24l5 5 11-11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Clean dataset
    </div>

    <div v-else class="space-y-2">
      <div v-for="r in rows" :key="r.name" class="grid grid-cols-[120px_1fr_60px] items-center gap-3 text-xs">
        <span class="font-mono truncate" :title="r.name">{{ r.name }}</span>
        <div class="relative h-5 bg-ink-100 rounded overflow-hidden">
          <div
            class="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500"
            :style="{ width: `${(r.pct / maxPct) * 100}%` }"
          />
        </div>
        <span class="text-right tabular-nums text-ink-600">
          {{ r.count.toLocaleString() }} <span class="text-ink-400">({{ r.pct.toFixed(1) }}%)</span>
        </span>
      </div>
    </div>
  </section>
</template>