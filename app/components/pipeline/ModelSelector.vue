<script setup lang="ts">
/**
 * ModelSelector — picks a model from the registry for the current task.
 *
 * PRD §6.1: "populated from GET /models?task=...".
 */
import type { ModelEntry } from '~/data/mockModels'

const props = defineProps<{
  modelValue: string | null
  models: ModelEntry[]
}>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

function pick(id: string) {
  emit('update:modelValue', id)
}
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
    <button
      v-for="m in models"
      :key="m.id"
      type="button"
      @click="pick(m.id)"
      :class="[
        'p-3 text-left rounded-lg border transition-colors',
        modelValue === m.id
          ? 'border-accent bg-accent-50/40 ring-2 ring-accent/15'
          : 'border-ink-200 bg-white hover:border-ink-300'
      ]"
    >
      <div class="flex items-center justify-between mb-1">
        <span class="text-sm font-semibold">{{ m.name }}</span>
        <span v-if="modelValue === m.id" class="text-[10px] font-mono uppercase tracking-wider text-accent">selected</span>
      </div>
      <p class="text-xs text-ink-500 leading-snug">{{ m.description }}</p>
      <div class="mt-2 text-[10px] font-mono text-ink-400">{{ m.parameters.length }} parameters</div>
    </button>
  </div>
</template>