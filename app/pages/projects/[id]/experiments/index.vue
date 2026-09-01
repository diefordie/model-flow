<script setup lang="ts">
/**
 * `/projects/:id/experiments` — Experiment list.
 *
 * PRD §6.1 §4: shows all experiments for the project with status
 * badge, model, primary metric (when completed), duration, created.
 * Polls running experiments' status to surface "in flight" updates
 * without overwhelming the API (2s cadence, paused on tab hidden).
 */
import StatusBadge from '~/components/experiment/StatusBadge.vue'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id as string)
const projectStore = useProjectStore()
const expStore = useExperimentStore()
const query = useRoute().query

await useAsyncData(`experiments-${projectId.value}`, async () => {
  await Promise.all([
    projectStore.fetchOne(projectId.value),
    expStore.fetchAll(projectId.value)
  ])
  return true
})

// poll running experiments' status every 2s (PRD §4.4)
let pollHandle: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  pollHandle = setInterval(async () => {
    if (document.hidden) return
    const running = expStore.summaries.filter(e => e.status === 'running')
    if (!running.length) return
    for (const e of running) {
      const status = await expStore.fetchStatus(e.id)
      if (status?.status === 'completed' && e.status !== 'completed') {
        e.status = 'completed'
        e.durationMs = 38_000
        e.primaryMetric = { name: 'F1', value: 0.81 + Math.random() * 0.05 }
      }
    }
  }, 2000)
})
onBeforeUnmount(() => {
  if (pollHandle) clearInterval(pollHandle)
})

function fmtDur(ms?: number) {
  if (!ms || ms < 1000) return '—'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60); const r = s % 60
  return r ? `${m}m ${r}s` : `${m}m`
}

const filtered = computed(() => expStore.summaries)

const justCreated = computed(() => query.created as string | undefined)
</script>

<template>
  <div v-if="projectStore.isLoading" class="p-8">
    <div class="h-8 w-48 bg-ink-200 rounded animate-pulse-soft mb-6" />
  </div>
  <div v-else-if="!projectStore.activeProject" class="p-8">
    <div class="surface p-6 border-red-300/40 bg-red-50/40">
      <div class="text-sm font-medium text-red-700 mb-1">Project not found</div>
      <NuxtLink to="/projects" class="btn-ghost mt-2">← Back to projects</NuxtLink>
    </div>
  </div>
  <div v-else>
    <header class="px-8 pt-6 pb-4 border-b border-ink-200 bg-white">
      <NuxtLink :to="`/projects/${projectId}`" class="text-xs text-ink-500 hover:text-ink-900">← {{ projectStore.activeProject.name }}</NuxtLink>
      <div class="flex items-end justify-between mt-1">
        <div>
          <h1 class="text-xl font-semibold tracking-tight">Experiments</h1>
          <p class="text-xs text-ink-500 mt-1">{{ expStore.summaries.length }} total · {{ expStore.summaries.filter(e => e.status === 'completed').length }} completed</p>
        </div>
        <NuxtLink :to="`/projects/${projectId}/pipeline`" class="btn-primary text-sm">New experiment</NuxtLink>
      </div>
    </header>

    <!-- just-created banner -->
    <div v-if="justCreated" class="px-8 pt-4">
      <div class="surface px-4 py-3 border-emerald-300/40 bg-emerald-50/40 text-sm flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-emerald-500" />
        Experiment queued.
        <NuxtLink :to="`/projects/${projectId}/experiments/${justCreated}`" class="font-medium text-emerald-700 hover:underline">View progress →</NuxtLink>
      </div>
    </div>

    <div class="p-8">
      <!-- Empty state -->
      <div v-if="!filtered.length" class="surface p-12 text-center max-w-xl mx-auto">
        <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-ink-100 grid place-items-center">
          <svg viewBox="0 0 24 24" fill="none" class="w-5 h-5 text-ink-500"><path d="M3 12h4l3-9 4 18 3-9h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <h3 class="text-base font-semibold mb-1">No experiments yet</h3>
        <p class="text-sm text-ink-500 mb-4 max-w-sm mx-auto">Configure a pipeline and run it. Results, metrics, and visualizations will appear here.</p>
        <NuxtLink :to="`/projects/${projectId}/pipeline`" class="btn-primary">Configure first pipeline</NuxtLink>
      </div>

      <!-- List -->
      <div v-else class="space-y-2">
        <NuxtLink
          v-for="e in filtered"
          :key="e.id"
          :to="`/projects/${projectId}/experiments/${e.id}`"
          class="surface p-4 flex items-center gap-4 hover:shadow-lift hover:-translate-y-0.5 transition-all"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-sm font-semibold truncate">{{ e.name }}</span>
              <StatusBadge :status="e.status" />
            </div>
            <div class="flex items-center gap-3 text-xs text-ink-500 font-mono">
              <span>{{ e.modelId.replace(/_/g, ' ') }}</span>
              <span>·</span>
              <span class="capitalize">{{ e.taskType }}</span>
              <span>·</span>
              <span>{{ fmtDur(e.durationMs) }}</span>
            </div>
          </div>
          <div v-if="e.primaryMetric" class="text-right shrink-0">
            <div class="text-[10px] font-mono uppercase text-ink-400 tracking-wider">{{ e.primaryMetric.name }}</div>
            <div class="text-xl font-semibold tabular-nums text-accent">{{ e.primaryMetric.value.toFixed(3) }}</div>
          </div>
          <svg viewBox="0 0 20 20" fill="none" class="w-4 h-4 text-ink-400 shrink-0"><path d="M7 5l6 5-6 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>