<script setup lang="ts">
/**
 * TargetSelector — single target column.
 *
 * PRD §6.1: "populated from GET /datasets/:datasetId/columns; disabled/
 * hidden for Clustering".
 *
 * Suggests binary/categorical columns for classification, numeric for
 * regression. Always allowed to override — backend re-validates.
 */
import type { ColumnMeta } from '~/types/api'
import type { TaskType } from '~/types/api'

const props = defineProps<{
  modelValue: string | null
  columns: ColumnMeta[]
  taskType: TaskType
}>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string | null): void }>()

const suggested = computed(() => {
  if (props.taskType === 'classification') {
    return props.columns.filter(c => c.dataType === 'binary' || c.dataType === 'categorical' || c.dataType === 'boolean')
  }
  if (props.taskType === 'regression') {
    return props.columns.filter(c => c.dataType === 'numeric')
  }
  return []
})

const otherNumeric = computed(() => props.columns.filter(c => c.dataType === 'numeric' && !suggested.value.includes(c)))
const otherCategorical = computed(() => props.columns.filter(c => (c.dataType === 'categorical' || c.dataType === 'boolean' || c.dataType === 'binary') && !suggested.value.includes(c)))

function pick(name: string | null) {
  emit('update:modelValue', name)
}
</script>

<template>
  <div>
    <p class="text-xs text-ink-500 mb-2">
      What do you want to predict? <span v-if="taskType === 'classification'">Categorical / binary columns usually work best.</span>
      <span v-else-if="taskType === 'regression'">Numeric columns are required for regression targets.</span>
    </p>

    <!-- Suggested -->
    <div v-if="suggested.length" class="mb-3">
      <div class="text-[10px] font-mono uppercase tracking-wider text-ink-400 mb-1.5">Suggested</div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="c in suggested"
          :key="c.name"
          type="button"
          @click="pick(c.name)"
          :class="[
            'px-3 h-8 rounded-full text-sm font-medium transition-colors border',
            modelValue === c.name
              ? 'border-accent bg-accent text-white'
              : 'border-ink-200 bg-white hover:border-accent hover:text-accent'
          ]"
        >
          {{ c.name }}
          <span class="ml-1 text-[10px] font-mono opacity-70">{{ c.dataType }}</span>
        </button>
      </div>
    </div>

    <!-- Other numeric (regression) or categorical -->
    <div v-if="otherNumeric.length || otherCategorical.length">
      <div class="text-[10px] font-mono uppercase tracking-wider text-ink-400 mb-1.5">Other columns</div>
      <select
        :value="modelValue ?? ''"
        @change="(($event.target as HTMLSelectElement).value ? pick(($event.target as HTMLSelectElement).value) : pick(null))"
        class="input"
      >
        <option value="">— pick a column —</option>
        <optgroup v-if="otherNumeric.length" label="Numeric">
          <option v-for="c in otherNumeric" :key="c.name" :value="c.name">{{ c.name }}</option>
        </optgroup>
        <optgroup v-if="otherCategorical.length" label="Categorical / binary">
          <option v-for="c in otherCategorical" :key="c.name" :value="c.name">{{ c.name }}</option>
        </optgroup>
      </select>
    </div>

    <p v-if="!suggested.length && !otherNumeric.length && !otherCategorical.length" class="text-xs text-ink-400 italic">
      No columns in this dataset yet.
    </p>
  </div>
</template>