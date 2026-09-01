<script setup lang="ts">
/**
 * Residuals — predicted vs residuals scatter (regression).
 *
 * Helps spot non-linearity, heteroscedasticity, and outliers. Pure SVG.
 */
import type { ResidualsData } from '~/types/api'

const props = defineProps<{ data: ResidualsData }>()

const W = 480
const H = 240
const padding = 24

const bounds = computed(() => {
  const xs = props.data.predicted
  const ys = props.data.residuals
  const xMin = Math.min(...xs), xMax = Math.max(...xs)
  const yMin = Math.min(...ys), yMax = Math.max(...ys)
  const yPad = (yMax - yMin) * 0.1
  return {
    xMin, xMax,
    yMin: yMin - yPad, yMax: yMax + yPad
  }
})

const sx = (x: number) => padding + ((x - bounds.value.xMin) / (bounds.value.xMax - bounds.value.xMin)) * (W - 2 * padding)
const sy = (y: number) => H - padding - ((y - bounds.value.yMin) / (bounds.value.yMax - bounds.value.yMin)) * (H - 2 * padding)

const points = computed(() => props.data.predicted.map((x, i) => ({
  x: sx(x), y: sy(props.data.residuals[i] ?? 0)
})))

const zeroY = computed(() => sy(0))
</script>

<template>
  <div class="overflow-x-auto">
    <svg :viewBox="`0 0 ${W} ${H}`" :width="W" :height="H" class="text-[10px] font-mono">
      <!-- grid -->
      <g class="text-ink-200" stroke="currentColor" stroke-width="1" fill="none">
        <line v-for="i in 4" :key="`gh-${i}`" :x1="padding" :x2="W - padding" :y1="padding + (i - 1) * (H - 2 * padding) / 4" :y2="padding + (i - 1) * (H - 2 * padding) / 4" />
        <line v-for="i in 5" :key="`gv-${i}`" :y1="padding" :y2="H - padding" :x1="padding + (i - 1) * (W - 2 * padding) / 4" :x2="padding + (i - 1) * (W - 2 * padding) / 4" />
      </g>
      <!-- zero residual -->
      <line :x1="padding" :x2="W - padding" :y1="zeroY" :y2="zeroY" class="stroke-ink-400" stroke-width="1" stroke-dasharray="3 3" />
      <!-- points -->
      <g>
        <circle v-for="(p, i) in points" :key="`p-${i}`" :cx="p.x" :cy="p.y" r="3" class="fill-accent" fill-opacity="0.65" />
      </g>
      <!-- axis labels -->
      <text :x="W / 2" :y="H - 4" text-anchor="middle" class="fill-ink-500 uppercase tracking-wider">Predicted</text>
      <text :transform="`translate(10, ${H / 2}) rotate(-90)`" text-anchor="middle" class="fill-ink-500 uppercase tracking-wider">Residuals</text>
    </svg>
  </div>
</template>