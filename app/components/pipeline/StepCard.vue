<script setup lang="ts">
/**
 * StepCard — single step in the pipeline configuration page.
 *
 * Visual: numbered circle (filled green when done, outlined otherwise) +
 * title + hint. Used as a wrapper so the page doesn't repeat the same
 * surface + header chrome per step.
 */
const props = defineProps<{
  step: string | number
  title: string
  done?: boolean
  hint?: string
}>()
</script>

<template>
  <section class="surface p-5">
    <header class="flex items-start gap-3 mb-4">
      <div
        :class="[
          'w-7 h-7 rounded-full grid place-items-center font-mono text-xs font-semibold shrink-0 transition-colors',
          done ? 'bg-accent text-white' : 'bg-ink-100 text-ink-600 border border-ink-200'
        ]"
      >
        <span v-if="done">✓</span>
        <span v-else>{{ step }}</span>
      </div>
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <h2 class="text-sm font-semibold">Step {{ step }}: {{ title }}</h2>
          <span v-if="done" class="text-[10px] font-mono uppercase tracking-wider text-accent">done</span>
        </div>
        <p v-if="hint" class="text-xs text-ink-500 mt-0.5">{{ hint }}</p>
      </div>
    </header>
    <slot />
  </section>
</template>