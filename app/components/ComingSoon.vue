<script setup lang="ts">
/**
 * Placeholder sub-page for project sub-nav routes that land in
 * Sprint 2+ (dataset, pipeline, experiments, dashboard, predictions).
 * Keeps the navigation truthful ("soon" tag) without 404ing.
 */
defineProps<{ sprint: string; title: string; description: string }>()
</script>

<template>
  <div class="px-8 py-10 max-w-2xl">
    <div class="surface p-10 text-center">
      <div class="inline-flex items-center gap-2 px-2.5 h-6 rounded-full bg-ink-100 text-xs font-mono uppercase tracking-wider text-ink-600 mb-4">
        Sprint {{ sprint }}
      </div>
      <h1 class="text-xl font-semibold tracking-tight mb-2">{{ title }}</h1>
      <p class="text-sm text-ink-500 max-w-md mx-auto mb-6">{{ description }}</p>
      <NuxtLink :to="`/projects/${$route.params.id}`" class="btn-ghost">← Back to project overview</NuxtLink>
    </div>
  </div>
</template>