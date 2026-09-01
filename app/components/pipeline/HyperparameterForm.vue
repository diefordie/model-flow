<script setup lang="ts">
/**
 * HyperparameterForm — renders inputs from server-provided schema.
 *
 * PRD §6.1 §07 §2: "must NOT hard-code fields per model. Consumes the
 * parameters array returned by GET /models and renders one input per
 * parameter based on type (integer, float, enum, boolean), using
 * min/max/options/default as given. Adding a new model server-side
 * should require zero frontend changes to this component."
 */
import type { ModelParam } from '~/data/mockModels'

const props = defineProps<{
  parameters: ModelParam[]
  modelValue: Record<string, number | string | boolean>
}>()
const emit = defineEmits<{ (e: 'update:modelValue', v: Record<string, number | string | boolean>): void }>()

function setVal(name: string, v: number | string | boolean) {
  emit('update:modelValue', { ...props.modelValue, [name]: v })
}

function currentValue(p: ModelParam): number | string | boolean {
  if (name in props.modelValue) return props.modelValue[name]!
  return p.default ?? ''
}

function clampInt(p: ModelParam, raw: string): number {
  let n = parseInt(raw, 10)
  if (Number.isNaN(n)) n = (p.default as number) ?? 0
  if (p.min !== undefined) n = Math.max(p.min, n)
  if (p.max !== undefined) n = Math.min(p.max, n)
  return n
}

function clampFloat(p: ModelParam, raw: string): number {
  let n = parseFloat(raw)
  if (Number.isNaN(n)) n = (p.default as number) ?? 0
  if (p.min !== undefined) n = Math.max(p.min, n)
  if (p.max !== undefined) n = Math.min(p.max, n)
  return n
}
</script>

<template>
  <div v-if="parameters.length === 0" class="text-sm text-ink-500 italic">
    This model has no configurable parameters.
  </div>
  <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div v-for="p in parameters" :key="p.name">
      <label class="label">
        <span class="font-mono">{{ p.name }}</span>
        <span class="text-ink-400 font-normal"> · {{ p.type }}</span>
      </label>

      <!-- enum: select -->
      <select
        v-if="p.type === 'enum' && p.options"
        :value="currentValue(p)"
        @change="setVal(p.name, ($event.target as HTMLSelectElement).value)"
        class="input"
      >
        <option v-for="opt in p.options" :key="opt" :value="opt">{{ opt }}</option>
      </select>

      <!-- boolean: toggle -->
      <button
        v-else-if="p.type === 'boolean'"
        type="button"
        @click="setVal(p.name, !currentValue(p))"
        :class="[
          'relative h-6 w-11 rounded-full transition-colors',
          currentValue(p) ? 'bg-accent' : 'bg-ink-300'
        ]"
        :aria-pressed="Boolean(currentValue(p))"
        role="switch"
      >
        <span
          :class="[
            'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
            currentValue(p) ? 'translate-x-5' : 'translate-x-0'
          ]"
        />
      </button>

      <!-- integer: number input -->
      <input
        v-else-if="p.type === 'integer'"
        type="number"
        :min="p.min"
        :max="p.max"
        step="1"
        :value="currentValue(p)"
        @input="setVal(p.name, clampInt(p, ($event.target as HTMLInputElement).value))"
        class="input tabular-nums"
      />

      <!-- float: number input -->
      <input
        v-else-if="p.type === 'float'"
        type="number"
        :min="p.min"
        :max="p.max"
        step="0.01"
        :value="currentValue(p)"
        @input="setVal(p.name, clampFloat(p, ($event.target as HTMLInputElement).value))"
        class="input tabular-nums"
      />

      <p v-if="p.description" class="mt-1 text-[11px] text-ink-400">{{ p.description }}</p>
    </div>
  </div>
</template>