<script setup lang="ts">
/**
 * RocCurve — line chart of FPR vs TPR per class + diagonal random baseline.
 *
 * Renders as inline SVG. For binary classification there's one curve;
 * for multiclass the API returns one curve per class.
 */
import type { RocCurveData } from '~/types/api'

const props = defineProps<{ data: RocCurveData }>()

const W = 320
const H = 240
const padding = 24

const curves = computed(() => props.data.fpr.map((fpr, i) => ({
  fpr,
  tpr: props.data.tpr[i] ?? [],
  color: ['#5b21b6', '#0891b2', '#16a34a', '#d97706', '#dc2626'][i % 5]
})))

const linePath = (fpr: number[], tpr: number[]) => {
  if (!fpr.length) return ''
  const sx = (x: number) => padding + x * (W - 2 * padding)
  const sy = (y: number) => H - padding - y * (H - 2 * padding)
  return fpr.map((x, i) => `${i === 0 ? 'M' : 'L'} ${sx(x).toFixed(1)} ${sy(tpr[i] ?? 0).toFixed(1)}`).join(' ')
}
</script>

<template>
  <div class="overflow-x-auto">
    <svg :viewBox="`0 0 ${W} ${H}`" :width="W" :height="H" class="text-[10px] font-mono">
      <!-- grid -->
      <g :stroke="'currentColor'" class="text-ink-200" stroke-width="1" fill="none">
        <line v-for="i in 4" :key="`gh-${i}`" :x1="padding" :x2="W - padding" :y1="padding + (i - 1) * (H - 2 * padding) / 4" :y2="padding + (i - 1) * (H - 2 * padding) / 4" />
        <line v-for="i in 4" :key="`gv-${i}`" :y1="padding" :y2="H - padding" :x1="padding + (i - 1) * (W - 2 * padding) / 4" :x2="padding + (i - 1) * (W - 2 * padding) / 4" />
      </g>
      <!-- random baseline -->
      <line :x1="padding" :y1="H - padding" :x2="W - padding" :y2="padding" class="stroke-ink-300" stroke-width="1" stroke-dasharray="3 3" />
      <!-- curves -->
      <path v-for="(c, i) in curves" :key="`c-${i}`" :d="linePath(c.fpr, c.tpr)" :stroke="c.color" stroke-width="2" fill="none" />
      <!-- axis labels -->
      <text :x="W / 2" :y="H - 4" text-anchor="middle" class="fill-ink-500 uppercase tracking-wider">False Positive Rate</text>
      <text :transform="`translate(10, ${H / 2}) rotate(-90)`" text-anchor="middle" class="fill-ink-500 uppercase tracking-wider">True Positive Rate</text>
      <!-- AUC badge -->
      <rect :x="W - padding - 64" :y="padding - 6" width="60" height="16" rx="3" class="fill-accent-50" />
      <text :x="W - padding - 4" :y="padding + 6" text-anchor="end" class="fill-accent font-semibold text-xs">
        AUC = {{ data.auc.toFixed(3) }}
      </text>
    </svg>
  </div>
</template>