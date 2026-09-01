<script setup lang="ts">
/**
 * TrainingConfig — optimization method, CV folds, scoring metric.
 */
import type { TrainingConfig } from '~/types/api'
import { metricsForTask } from '~/data/mockModels'
import type { TaskType } from '~/types/api'

const props = defineProps<{ modelValue: TrainingConfig; taskType: TaskType }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: TrainingConfig): void }>()

function patch(p: Partial<TrainingConfig>) {
  emit('update:modelValue', { ...props.modelValue, ...p })
}

const metrics = computed(() => metricsForTask(props.taskType))
const isSupervised = computed(() => props.taskType !== 'clustering')

watch(() => props.taskType, () => {
  // when task changes, pick the first metric if current is invalid
  if (isSupervised.value) {
    const allowed = metrics.value.map(m => m.value)
    if (!allowed.includes(props.modelValue.scoring)) {
      patch({ scoring: allowed[0] ?? '' })
    }
  }
})

function isOptimizationManual() {
  return props.modelValue.optimization === 'manual'
}
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <div>
      <label class="label">Optimization</label>
      <select :value="modelValue.optimization" @change="patch({ optimization: ($event.target as HTMLSelectElement).value as any })" class="input">
        <option value="manual">Manual</option>
        <option value="grid">Grid search</option>
        <option value="random">Random search</option>
      </select>
    </div>
    <div v-if="!isOptimizationManual()">
      <label class="label">CV folds</label>
      <input
        type="number"
        min="2" max="20" step="1"
        :value="modelValue.cvFolds"
        @input="patch({ cvFolds: Math.max(2, Math.min(20, parseInt(($event.target as HTMLInputElement).value, 10) || 5)) })"
        class="input tabular-nums"
      />
    </div>
    <div v-if="isSupervised">
      <label class="label">Scoring metric</label>
      <select :value="modelValue.scoring" @change="patch({ scoring: ($event.target as HTMLSelectElement).value })" class="input">
        <option v-for="m in metrics" :key="m.value" :value="m.value">{{ m.label }}</option>
      </select>
    </div>
  </div>

  <div v-if="modelValue.optimization !== 'manual'" class="mt-3 text-xs text-ink-500 bg-ink-50 border border-ink-200 rounded-lg px-3 py-2">
    <span class="font-medium text-ink-700">Heads up:</span>
    {{ modelValue.optimization === 'grid' ? 'Grid search' : 'Random search' }}
    with {{ modelValue.cvFolds }}-fold CV runs the model many times. Training takes longer.
  </div>
</template>