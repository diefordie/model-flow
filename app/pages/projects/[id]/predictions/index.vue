<script setup lang="ts">
/**
 * /projects/:id/predictions — list of completed experiments in this
 * project, each is a model that can be used for live predictions.
 *
 * Click an experiment → drill into the per-experiment playground at
 * /projects/:id/predictions/:expId.
 */
import StatusBadge from '~/components/experiment/StatusBadge.vue'

const route = useRoute()
const projectId = computed(() => route.params.id as string)
const projectStore = useProjectStore()
const expStore = useExperimentStore()

// Data fetch is client-only: real-mode endpoints require a Bearer token
// which lives in localStorage and is invisible to SSR. Doing this on the
// client also avoids an SSR 401 → "Project not found" flash.
const { data: _loaded } = await useAsyncData(`predictions-list-${projectId.value}`, async () => {
  if (import.meta.client) {
    try {
      await projectStore.fetchOne(projectId.value)
      await expStore.fetchAll(projectId.value)
    } catch (e) {
      console.error('[predictions] fetch failed:', e)
    }
  }
  return true
})

const completed = computed(() =>
  expStore.summaries.filter(e => e.status === 'completed')
)
</script>

<template>
  <div v-if="!projectStore.activeProject" class="p-8">
    <div class="surface p-6 border-red-300/40 bg-red-50/40">
      <div class="text-sm font-medium text-red-700 mb-1">Project not found</div>
      <NuxtLink to="/projects" class="btn-ghost mt-2">← Back to projects</NuxtLink>
    </div>
  </div>
  <div v-else class="max-w-4xl mx-auto px-6 py-8">
    <NuxtLink :to="`/projects/${projectId}`" class="text-sm text-ink-500 hover:text-ink-900 transition-colors">
      ← {{ projectStore.activeProject.name }}
    </NuxtLink>
    <div class="mt-1 flex items-end justify-between">
      <div>
        <h1 class="text-xl font-semibold tracking-tight">Predictions</h1>
        <p class="text-sm text-ink-500 mt-1">Run live predictions against any completed experiment in this project.</p>
      </div>
      <span class="text-xs text-ink-500 font-mono">{{ completed.length }} completed</span>
    </div>

    <div v-if="expStore.summaries.length === 0" class="surface p-8 mt-6 text-center">
      <div class="w-12 h-12 rounded-full bg-ink-100 grid place-items-center mx-auto mb-3">
        <svg viewBox="0 0 24 24" fill="none" class="w-6 h-6 text-ink-500"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </div>
      <h2 class="text-base font-semibold mb-1">No experiments yet</h2>
      <p class="text-sm text-ink-500 mb-4 max-w-md mx-auto">Train at least one model in the pipeline before you can run predictions.</p>
      <NuxtLink :to="`/projects/${projectId}/pipeline`" class="btn-primary">Configure a pipeline</NuxtLink>
    </div>

    <div v-else-if="completed.length === 0" class="surface p-8 mt-6 text-center">
      <div class="w-12 h-12 rounded-full bg-amber-50 grid place-items-center mx-auto mb-3">
        <svg viewBox="0 0 24 24" fill="none" class="w-6 h-6 text-amber-600"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/><path d="M12 7v6l4 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </div>
      <h2 class="text-base font-semibold mb-1">Waiting for a completed model</h2>
      <p class="text-sm text-ink-500 mb-4 max-w-md mx-auto">Predictions need a trained model. Your {{ expStore.summaries.length }} experiment{{ expStore.summaries.length === 1 ? '' : 's' }} {{ expStore.summaries.length === 1 ? 'is' : 'are' }} still running or failed.</p>
      <NuxtLink :to="`/projects/${projectId}/experiments`" class="btn-ghost">View experiments →</NuxtLink>
    </div>

    <div v-else class="mt-6 space-y-2">
      <NuxtLink
        v-for="exp in completed"
        :key="exp.id"
        :to="`/projects/${projectId}/predictions/${exp.id}`"
        class="surface p-4 flex items-center gap-4 hover:border-ink-300 transition-colors group"
      >
        <div class="w-9 h-9 rounded-md bg-ink-950 text-white grid place-items-center font-bold text-sm shrink-0">
          {{ exp.taskType.charAt(0).toUpperCase() }}
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate">{{ exp.name }}</div>
          <div class="text-xs text-ink-500 flex items-center gap-2 mt-0.5">
            <span class="capitalize">{{ exp.taskType }}</span>
            <span class="text-ink-300">·</span>
            <span class="font-mono">#{{ exp.id }}</span>
            <span v-if="exp.primaryMetric" class="text-ink-300">·</span>
            <span v-if="exp.primaryMetric">{{ exp.primaryMetric.name }} {{ (exp.primaryMetric.value * 100).toFixed(1) }}%</span>
          </div>
        </div>
        <StatusBadge :status="exp.status" />
        <svg viewBox="0 0 20 20" fill="none" class="w-4 h-4 text-ink-400 group-hover:text-ink-900 transition-colors shrink-0">
          <path d="M7.5 5l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </NuxtLink>
    </div>
  </div>
</template>
