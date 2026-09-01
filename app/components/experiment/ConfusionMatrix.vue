<script setup lang="ts">
/**
 * ConfusionMatrix — heatmap of true × predicted counts.
 *
 * PRD §6.1 §07. Pure SVG (no library) — diagonals are green-tinted,
 * off-diagonals are red-tinted, intensity scales with count.
 */
import type { ConfusionMatrixData } from '~/types/api'

const props = defineProps<{ data: ConfusionMatrixData }>()

// normalize cell colors by row max so a single row's diagonal pops
const cellClass = (row: number, col: number) => {
  const rowMax = Math.max(...props.data.matrix[row])
  if (rowMax === 0) return 'fill-ink-100'
  const v = props.data.matrix[row][col] / rowMax
  if (row === col) {
    if (v >= 0.7) return 'fill-emerald-500'
    if (v >= 0.4) return 'fill-emerald-400'
    return 'fill-emerald-300'
  }
  // off-diagonal: red intensity
  if (v >= 0.2) return 'fill-red-500'
  if (v >= 0.1) return 'fill-red-400'
  return 'fill-red-300'
}

const cellOpacity = (row: number, col: number) => {
  const rowMax = Math.max(...props.data.matrix[row])
  const v = props.data.matrix[row][col] / (rowMax || 1)
  return Math.max(0.25, v)
}

const cellSize = 56
const labelSize = 28
const W = computed(() => props.data.classes.length * cellSize + labelSize)
const H = computed(() => props.data.classes.length * cellSize + labelSize + 16)
</script>

<template>
  <div class="overflow-x-auto">
    <svg :viewBox="`0 0 ${W} ${H}`" :width="W" :height="H" class="text-[10px] font-mono">
      <!-- column headers -->
      <g v-for="(cls, c) in data.classes" :key="`ch-${c}`" :transform="`translate(${labelSize + c * cellSize + cellSize / 2}, ${labelSize - 6})`">
        <text text-anchor="middle" class="fill-ink-600">{{ cls }}</text>
      </g>
      <!-- row headers -->
      <g v-for="(cls, r) in data.classes" :key="`rh-${r}`" :transform="`translate(${labelSize - 8}, ${labelSize + r * cellSize + cellSize / 2})`">
        <text text-anchor="end" dominant-baseline="middle" class="fill-ink-600">{{ cls }}</text>
      </g>
      <!-- cells -->
      <g v-for="(row, r) in data.matrix" :key="`row-${r}`">
        <g v-for="(v, c) in row" :key="`cell-${r}-${c}`" :transform="`translate(${labelSize + c * cellSize}, ${labelSize + r * cellSize})`">
          <rect :width="cellSize - 2" :height="cellSize - 2" rx="4"
                :class="cellClass(r, c)"
                :fill-opacity="cellOpacity(r, c)" />
          <text :x="(cellSize - 2) / 2" :y="(cellSize - 2) / 2 + 4" text-anchor="middle"
                class="fill-ink-900 font-semibold">{{ v }}</text>
        </g>
      </g>
      <!-- axis labels -->
      <text :x="labelSize + (data.classes.length * cellSize) / 2" :y="14" text-anchor="middle" class="fill-ink-500 uppercase tracking-wider">Predicted</text>
      <text :transform="`translate(8, ${labelSize + (data.classes.length * cellSize) / 2}) rotate(-90)`" text-anchor="middle" class="fill-ink-500 uppercase tracking-wider">Actual</text>
    </svg>
  </div>
</template>