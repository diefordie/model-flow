<script setup lang="ts">
/**
 * TaskSelector — Classification / Regression / Clustering.
 *
 * PRD §6.1. Disables Clustering in a hint if dataset is unsuitable,
 * but MVP doesn't gate it — backend validates.
 */
import type { TaskType } from '~/types/api'

const props = defineProps<{ modelValue: TaskType }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: TaskType): void }>()

const options: Array<{ value: TaskType; label: string; description: string }> = [
  { value: 'classification', label: 'Classification', description: 'Predict a discrete category (yes/no, type A/B/C).' },
  { value: 'regression',     label: 'Regression',     description: 'Predict a continuous number (price, temperature).' },
  { value: 'clustering',     label: 'Clustering',     description: 'Group similar rows without a target column.' }
]

function pick(v: TaskType) {
  if (v !== props.modelValue) emit('update:modelValue', v)
}
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      @click="pick(opt.value)"
      :class="[
        'p-4 text-left rounded-lg border-2 transition-colors',
        modelValue === opt.value
          ? 'border-accent bg-accent-50/40 ring-2 ring-accent/15'
          : 'border-ink-200 bg-white hover:border-ink-300'
      ]"
    >
      <div class="flex items-center gap-2 mb-1">
        <span :class="['w-4 h-4 rounded-full border-2 grid place-items-center',
          modelValue === opt.value ? 'border-accent' : 'border-ink-300']">
          <span v-if="modelValue === opt.value" class="w-2 h-2 rounded-full bg-accent" />
        </span>
        <span class="text-sm font-semibold">{{ opt.label }}</span>
      </div>
      <p class="text-xs text-ink-500 leading-snug">{{ opt.description }}</p>
    </button>
  </div>
</template>