<script setup lang="ts">
/**
 * DashboardWidget — renders one widget from structured data.
 *
 * Per PRD §07 §4: "Adding a new chart type later only requires a new
 * widgetType handler in DashboardWidget." This component is the single
 * dispatch point — it switches on widgetType and renders the matching
 * chart. Backend sends data; we render.
 */
import type { DashboardWidget } from '~/types/api'
import ConfusionMatrix from '~/components/experiment/ConfusionMatrix.vue'
import RocCurve from '~/components/experiment/RocCurve.vue'
import Residuals from '~/components/experiment/Residuals.vue'
import FeatureImportance from '~/components/experiment/FeatureImportance.vue'

const props = defineProps<{
  widget: DashboardWidget
  /** Edit mode: show remove button + dashed border */
  editable?: boolean
}>()
const emit = defineEmits<{ (e: 'remove', id: string): void }>()

// ── Inline chart renderers (no library) ────────────────────────────────

const barChart = computed(() => {
  if (props.widget.type !== 'bar_chart') return null
  const items = (props.widget.data as Array<{ name: string; value: number }>) ?? []
  if (!items.length) return null
  const max = Math.max(...items.map(i => i.value), 0.001)
  return { items, max }
})

const heatmap = computed(() => {
  if (props.widget.type !== 'heatmap') return null
  const d = props.widget.data as { classes: string[]; matrix: number[][] } | undefined
  return d
})

const scatter = computed(() => {
  if (props.widget.type !== 'scatter_chart') return null
  return props.widget.data as { predicted: number[]; residuals: number[] } | undefined
})

const dist = computed(() => {
  if (props.widget.type !== 'distribution') return null
  return props.widget.data as Array<{ name: string; values: number[] }> | undefined
})

const stat = computed(() => {
  if (props.widget.type !== 'stat_table') return null
  return props.widget.data as { columns: string[]; rows: Array<Array<string | number>> } | undefined
})

const metric = computed(() => {
  if (props.widget.type !== 'metric_card') return null
  return props.widget.data as { label: string; value: number } | undefined
})

// ── Heatmap dimensions ────────────────────────────────────────────────

const truncate = (s: string, n: number) => s.length > n ? s.slice(0, n - 1) + '…' : s
const labelColWidth = 110  // left labels — "DiabetesPedigreeFu…" needs ~14 chars at 7px each
const labelRowHeight = 70  // top rotated labels need vertical space; -35° = ~24px wide
const cellSize = 30
const heatmapW = computed(() => (heatmap.value?.classes.length ?? 0) * cellSize + labelColWidth + 16)
const heatmapH = computed(() => (heatmap.value?.classes.length ?? 0) * cellSize + labelRowHeight + 12)

const heatmapColor = (v: number) => {
  const abs = Math.abs(v)
  if (v > 0) {
    if (abs >= 0.7) return 'fill-accent-700'
    if (abs >= 0.4) return 'fill-accent-500'
    return 'fill-accent-300'
  } else {
    if (abs >= 0.7) return 'fill-red-500'
    if (abs >= 0.4) return 'fill-red-400'
    return 'fill-red-300'
  }
}
</script>

<template>
  <div :class="[
    'relative bg-white rounded-lg border p-4 h-full flex flex-col',
    editable ? 'border-dashed border-ink-300' : 'border-ink-200'
  ]">
    <!-- header -->
    <header class="flex items-start justify-between gap-2 mb-3">
      <div class="min-w-0">
        <h3 class="text-xs font-semibold truncate">{{ widget.title }}</h3>
        <p class="text-[10px] font-mono text-ink-400 uppercase tracking-wider">{{ widget.insight }}</p>
      </div>
      <button v-if="editable" @click="emit('remove', widget.id)"
              class="text-ink-400 hover:text-red-600 transition-colors shrink-0"
              aria-label="Remove widget">
        <svg viewBox="0 0 16 16" fill="none" class="w-3.5 h-3.5"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
    </header>

    <!-- body -->
    <div class="flex-1 min-h-0">
      <!-- metric_card -->
      <div v-if="metric" class="flex items-baseline gap-2">
        <span class="text-3xl font-semibold tabular-nums text-accent">{{ metric.value.toFixed(3) }}</span>
        <span class="text-xs text-ink-500">{{ metric.label }}</span>
      </div>

      <!-- stat_table -->
      <div v-else-if="stat" class="overflow-auto max-h-full">
        <table class="w-full text-xs">
          <thead class="text-ink-500 font-mono uppercase tracking-wider">
            <tr><th v-for="c in stat.columns" :key="c" class="text-left py-1 pr-3">{{ c }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="(row, ri) in stat.rows" :key="ri" class="border-t border-ink-100">
              <td v-for="(cell, ci) in row" :key="ci" class="py-1 pr-3 tabular-nums font-mono" :class="ci === 0 ? 'text-ink-700' : 'text-ink-600'">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- bar_chart -->
      <div v-else-if="barChart" class="space-y-1.5 overflow-y-auto max-h-full">
        <div v-for="d in barChart.items" :key="d.name" class="flex items-center gap-2">
          <span class="text-[11px] font-mono text-ink-700 w-32 truncate shrink-0">{{ d.name }}</span>
          <div class="flex-1 h-4 bg-ink-100 rounded relative overflow-hidden">
            <div class="absolute inset-y-0 left-0 bg-accent rounded" :style="{ width: `${(d.value / barChart.max) * 100}%` }" />
          </div>
          <span class="text-[11px] tabular-nums text-ink-500 w-12 text-right shrink-0">{{ d.value.toLocaleString() }}</span>
        </div>
      </div>

      <!-- heatmap (correlation) -->
      <div v-else-if="heatmap" class="overflow-auto">
        <svg :viewBox="`0 0 ${heatmapW} ${heatmapH}`" :width="heatmapW" :height="heatmapH" class="text-[10px] font-mono">
          <g v-for="(cls, c) in heatmap.classes" :key="`ch-${c}`" :transform="`translate(${labelColWidth + c * cellSize + 2}, ${labelRowHeight - 6})`">
            <text text-anchor="start" class="fill-ink-600" :transform="`rotate(-45, 0, 6)`">{{ truncate(cls, 14) }}</text>
          </g>
          <g v-for="(cls, r) in heatmap.classes" :key="`rh-${r}`" :transform="`translate(${labelColWidth - 8}, ${labelRowHeight + r * cellSize + cellSize / 2})`">
            <text text-anchor="end" dominant-baseline="middle" class="fill-ink-600">{{ truncate(cls, 14) }}</text>
          </g>
          <g v-for="(row, r) in heatmap.matrix" :key="`row-${r}`">
            <rect v-for="(v, c) in row" :key="`cell-${r}-${c}`"
                  :x="labelColWidth + c * cellSize + 1" :y="labelRowHeight + r * cellSize + 1"
                  :width="cellSize - 2" :height="cellSize - 2" rx="3"
                  :class="heatmapColor(v)" :fill-opacity="Math.max(0.2, Math.abs(v))" />
          </g>
        </svg>
      </div>

      <!-- confusion_matrix -->
      <ConfusionMatrix v-else-if="widget.type === 'confusion_matrix' && widget.data" :data="widget.data as any" />

      <!-- roc_curve -->
      <RocCurve v-else-if="widget.type === 'roc_curve' && widget.data" :data="widget.data as any" />

      <!-- scatter (residuals) -->
      <Residuals v-else-if="widget.type === 'scatter_chart' && scatter" :data="scatter" />

      <!-- distribution (mini histograms) -->
      <div v-else-if="dist" class="space-y-3 overflow-y-auto max-h-full">
        <div v-for="d in dist" :key="d.name">
          <div class="text-[10px] font-mono text-ink-500 mb-1">{{ d.name }}</div>
          <div class="flex items-end h-12 gap-px">
            <div v-for="(v, i) in 20" :key="i"
                 class="flex-1 bg-accent rounded-t"
                 :style="{ height: `${Math.min(100, ((d.values[i * 10] ?? 0) / (Math.max(...d.values, 0.001))) * 100)}%` }" />
          </div>
        </div>
      </div>

      <!-- empty -->
      <div v-else class="text-xs text-ink-400 italic">No data</div>
    </div>
  </div>
</template>