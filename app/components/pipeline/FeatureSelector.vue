<script setup lang="ts">
/**
 * FeatureSelector — checkbox list.
 *
 * PRD §6.1: "checkbox list; target column must be excluded and disabled
 * from selection".
 *
 * Default-selects numeric columns (excluding target) for a sensible
 * starting point; user can toggle.
 */
import type { ColumnMeta } from '~/types/api'

const props = defineProps<{
  modelValue: string[]
  columns: ColumnMeta[]
  target: string | null
}>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string[]): void }>()

const isSelected = (name: string) => props.modelValue.includes(name)
const isDisabled = (name: string) => props.target === name

function toggle(name: string) {
  if (isDisabled(name)) return
  const next = isSelected(name)
    ? props.modelValue.filter(n => n !== name)
    : [...props.modelValue, name]
  emit('update:modelValue', next)
}

function selectAllNumeric() {
  const next = props.columns
    .filter(c => c.dataType === 'numeric' && !isDisabled(c.name))
    .map(c => c.name)
  emit('update:modelValue', next)
}

function clearAll() {
  emit('update:modelValue', [])
}

function autoSuggest() {
  // pick all numeric columns except target (default behavior on first load)
  selectAllNumeric()
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-2">
      <p class="text-xs text-ink-500">
        Pick the columns the model will use. <span v-if="target" class="text-ink-400">({{ target }} is the target — disabled)</span>
      </p>
      <div class="flex items-center gap-1">
        <button type="button" class="btn-ghost h-7 px-2 text-xs" @click="autoSuggest">Auto</button>
        <button type="button" class="btn-ghost h-7 px-2 text-xs" @click="clearAll">Clear</button>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-72 overflow-y-auto rounded-lg border border-ink-200 p-2">
      <label
        v-for="c in columns"
        :key="c.name"
        :class="[
          'flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer transition-colors',
          isDisabled(c.name) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ink-50'
        ]"
      >
        <input
          type="checkbox"
          :checked="isSelected(c.name)"
          :disabled="isDisabled(c.name)"
          @change="toggle(c.name)"
          class="rounded border-ink-300 text-accent focus:ring-accent"
        />
        <span class="font-mono text-xs truncate flex-1">{{ c.name }}</span>
        <span :class="{
          'badge-neutral': c.dataType === 'numeric',
          'badge-success': c.dataType === 'binary' || c.dataType === 'boolean',
          'badge-warning': c.dataType === 'categorical' || c.dataType === 'text',
          'badge-running': c.dataType === 'datetime'
        }" class="font-mono normal-case">{{ c.dataType }}</span>
      </label>
    </div>

    <div class="mt-2 text-xs text-ink-500">
      {{ modelValue.length }} of {{ columns.length }} columns selected
    </div>
  </div>
</template>