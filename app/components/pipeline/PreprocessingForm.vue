<script setup lang="ts">
/**
 * PreprocessingForm — missing values, scaling, encoding, split.
 *
 * PRD §6.1 §05 §4 — options from the Python worker.
 */
import type { PreprocessingConfig } from '~/types/api'

const props = defineProps<{ modelValue: PreprocessingConfig }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: PreprocessingConfig): void }>()

function patch(p: Partial<PreprocessingConfig>) {
  emit('update:modelValue', { ...props.modelValue, ...p })
}

const missingOptions = [
  { v: 'drop',          l: 'Drop rows' },
  { v: 'mean',          l: 'Mean (numeric)' },
  { v: 'median',        l: 'Median (numeric)' },
  { v: 'most_frequent', l: 'Most frequent' },
  { v: 'constant',      l: 'Constant (0)' }
]
const scalingOptions = [
  { v: 'none',     l: 'None' },
  { v: 'standard', l: 'Standard (z-score)' },
  { v: 'minmax',   l: 'Min-max [0,1]' },
  { v: 'robust',   l: 'Robust (median/IQR)' }
]
const encodingOptions = [
  { v: 'onehot',  l: 'One-hot' },
  { v: 'ordinal', l: 'Ordinal' }
]
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div>
      <label class="label">Missing values</label>
      <select :value="modelValue.missingValues" @change="patch({ missingValues: ($event.target as HTMLSelectElement).value as any })" class="input">
        <option v-for="o in missingOptions" :key="o.v" :value="o.v">{{ o.l }}</option>
      </select>
    </div>
    <div>
      <label class="label">Scaling</label>
      <select :value="modelValue.scaling" @change="patch({ scaling: ($event.target as HTMLSelectElement).value as any })" class="input">
        <option v-for="o in scalingOptions" :key="o.v" :value="o.v">{{ o.l }}</option>
      </select>
    </div>
    <div>
      <label class="label">Encoding (categorical)</label>
      <select :value="modelValue.encoding" @change="patch({ encoding: ($event.target as HTMLSelectElement).value as any })" class="input">
        <option v-for="o in encodingOptions" :key="o.v" :value="o.v">{{ o.l }}</option>
      </select>
    </div>
    <div>
      <label class="label">Random seed</label>
      <input
        type="number"
        :value="modelValue.randomState"
        @input="patch({ randomState: parseInt(($event.target as HTMLInputElement).value, 10) || 42 })"
        class="input"
      />
    </div>
    <div class="sm:col-span-2">
      <label class="label">Train / test split <span class="text-ink-400 font-normal">(test = {{ Math.round(modelValue.testSize * 100) }}%)</span></label>
      <input
        type="range"
        min="0.1" max="0.5" step="0.05"
        :value="modelValue.testSize"
        @input="patch({ testSize: parseFloat(($event.target as HTMLInputElement).value) })"
        class="w-full accent-accent"
      />
      <div class="flex justify-between text-[10px] text-ink-400 font-mono mt-1">
        <span>90/10</span><span>80/20</span><span>70/30</span><span>60/40</span><span>50/50</span>
      </div>
    </div>
  </div>
</template>