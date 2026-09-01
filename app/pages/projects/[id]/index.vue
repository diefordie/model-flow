<script setup lang="ts">
/**
 * `/projects/:id` — Project overview.
 *
 * PRD §6.1: "Summary of project status + shortcuts into Dataset /
 * Pipeline / Experiments / Dashboard."
 *
 * Sub-nav pattern: PRD §2.5 second diagram shows the project sub-nav
 * replacing the global sidebar or nesting under it. We nest it here as
 * a horizontal sub-tabs bar at the top of the workspace pane — the
 * global sidebar stays visible so users always see "Projects" context.
 */
import { formatDistanceToNow } from '~/utils/format'

const route = useRoute()
const store = useProjectStore()
const api = useApi()

const projectId = computed(() => route.params.id as string)

await useAsyncData(`project-${projectId.value}`, async () => {
  await store.fetchOne(projectId.value)
  return true
})

// sub-nav links — Sprint 2+ will fill these out; for now they're
// placeholders that surface a "coming soon" notice
const subNav = [
  { to: '',           label: 'Overview'    },
  { to: 'dataset',    label: 'Dataset'     },
  { to: 'pipeline',   label: 'Pipeline'    },
  { to: 'experiments',label: 'Experiments' },
  { to: 'dashboard',  label: 'Dashboard'   },
  { to: 'predictions',label: 'Predictions' }
]

const experimentsList = ref<Array<{ id: string; name: string; status: string; modelId: string; createdAt: string }>>([])
onMounted(async () => {
  try { experimentsList.value = await api.listExperiments(projectId.value) } catch { experimentsList.value = [] }
})

function badgeFor(status: string) {
  return {
    queued:    'badge-neutral',
    running:   'badge-running',
    completed: 'badge-success',
    failed:    'badge-danger',
    cancelled: 'badge-warning'
  }[status] ?? 'badge-neutral'
}
</script>

<template>
  <div v-if="store.isLoading" class="p-8 max-w-5xl">
    <div class="h-8 w-64 bg-ink-200 rounded animate-pulse-soft mb-4" />
    <div class="h-4 w-96 bg-ink-100 rounded animate-pulse-soft mb-8" />
    <div class="grid grid-cols-3 gap-4 mb-8">
      <div v-for="i in 3" :key="i" class="surface p-5 h-24 animate-pulse-soft" />
    </div>
  </div>

  <div v-else-if="store.error || !store.activeProject" class="p-8 max-w-xl">
    <div class="surface p-6 border-danger/30 bg-red-50/40">
      <div class="text-sm font-medium text-red-700 mb-1">Couldn't load this project</div>
      <div class="text-sm text-red-600/90 mb-3">{{ store.error ?? 'Project not found.' }}</div>
      <NuxtLink to="/projects" class="btn-ghost border border-red-200">← Back to projects</NuxtLink>
    </div>
  </div>

  <div v-else class="max-w-5xl">
    <!-- Sub-nav header -->
    <header class="px-8 pt-6 pb-0 border-b border-ink-200 bg-white">
      <div class="flex items-center justify-between mb-3">
        <div>
          <NuxtLink to="/projects" class="text-xs text-ink-500 hover:text-ink-900">← Projects</NuxtLink>
          <h1 class="text-xl font-semibold tracking-tight mt-1 flex items-center gap-2">
            {{ store.activeProject.name }}
            <span class="badge-success">{{ store.activeProject.status }}</span>
          </h1>
        </div>
        <div class="text-xs text-ink-500">
          Updated {{ formatDistanceToNow(store.activeProject.updatedAt) }}
        </div>
      </div>

      <nav class="flex items-center gap-1 -mb-px">
        <NuxtLink
          v-for="item in subNav"
          :key="item.label"
          :to="item.to ? `/projects/${projectId}/${item.to}` : `/projects/${projectId}`"
          :class="[
            'px-3 h-10 -mb-px text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5',
            (route.path === `/projects/${projectId}` && !item.to) || route.path === `/projects/${projectId}/${item.to}`
              ? 'border-accent text-ink-900'
              : 'border-transparent text-ink-500 hover:text-ink-900'
          ]"
        >
          {{ item.label }}
          <span v-if="item.to && item.to !== 'dataset' && item.to !== 'pipeline' && item.to !== 'experiments'" class="text-[10px] text-ink-400 ml-1">soon</span>
        </NuxtLink>
      </nav>
    </header>

    <div class="p-8">
      <!-- Quick stats -->
      <section class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div class="surface p-5">
          <div class="text-xs text-ink-500 font-mono uppercase tracking-wider">Datasets</div>
          <div class="text-2xl font-semibold mt-1 tabular-nums">{{ store.activeProject.counts?.datasets ?? 0 }}</div>
          <div class="text-xs text-ink-400 mt-1">Upload via the Dataset tab</div>
        </div>
        <div class="surface p-5">
          <div class="text-xs text-ink-500 font-mono uppercase tracking-wider">Experiments</div>
          <div class="text-2xl font-semibold mt-1 tabular-nums">{{ experimentsList.length }}</div>
          <div class="text-xs text-ink-400 mt-1">{{ experimentsList.filter(e => e.status === 'running').length }} running</div>
        </div>
        <div class="surface p-5">
          <div class="text-xs text-ink-500 font-mono uppercase tracking-wider">Dashboards</div>
          <div class="text-2xl font-semibold mt-1 tabular-nums">{{ store.activeProject.counts?.dashboards ?? 0 }}</div>
          <div class="text-xs text-ink-400 mt-1">Generated from experiments</div>
        </div>
      </section>

      <!-- Shortcuts (bento: one featured + 3 standard) -->
      <section class="mb-6">
        <h2 class="text-sm font-semibold mb-3">Quick actions</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <!-- Featured: pipeline config (the highest-leverage action) -->
          <NuxtLink
            :to="`/projects/${projectId}/pipeline`"
            class="surface bg-ink-950 text-white p-5 lg:col-span-2 hover:shadow-lift transition-all group overflow-hidden relative"
          >
            <!-- subtle data-stripe pattern as ML signature -->
            <svg class="absolute inset-0 w-full h-full opacity-[0.06] pointer-events-none" preserveAspectRatio="none" viewBox="0 0 400 100" aria-hidden="true">
              <defs><pattern id="ds" width="3" height="100" patternUnits="userSpaceOnUse"><line x1="1.5" y1="0" x2="1.5" y2="100" stroke="white" stroke-width="1"/></pattern></defs>
              <rect width="400" height="100" fill="url(#ds)"/>
            </svg>
            <div class="relative">
              <div class="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-ink-300 mb-2">
                <span class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-soft" />
                Recommended next step
              </div>
              <div class="text-base font-semibold mb-1">Configure your pipeline</div>
              <div class="text-sm text-ink-300 mb-4 max-w-sm">Pick a target, choose features, select a model — start your first experiment.</div>
              <span class="text-sm font-medium text-accent group-hover:underline">Open pipeline →</span>
            </div>
          </NuxtLink>

          <!-- Standard actions -->
          <NuxtLink :to="`/projects/${projectId}/dataset`" class="surface p-4 hover:border-accent hover:text-accent transition-colors flex flex-col">
            <svg viewBox="0 0 16 16" fill="none" class="w-5 h-5 mb-2 text-ink-500"><path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            <div class="text-sm font-semibold">Upload dataset</div>
            <div class="text-xs text-ink-500 mt-1">CSV or XLSX</div>
          </NuxtLink>
          <NuxtLink :to="`/projects/${projectId}/experiments`" class="surface p-4 hover:border-accent hover:text-accent transition-colors flex flex-col">
            <svg viewBox="0 0 16 16" fill="none" class="w-5 h-5 mb-2 text-ink-500"><path d="M3 12l3-4 3 2 4-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            <div class="text-sm font-semibold">Experiments</div>
            <div class="text-xs text-ink-500 mt-1">View history</div>
          </NuxtLink>
        </div>
      </section>

      <!-- Recent experiments -->
      <section class="surface p-5">
        <header class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold">Recent experiments</h2>
          <NuxtLink :to="`/projects/${projectId}/experiments`" class="text-xs text-accent hover:underline">View all →</NuxtLink>
        </header>
        <div v-if="experimentsList.length === 0" class="text-sm text-ink-500 py-6 text-center">
          No experiments yet. Configure your first pipeline to start experimenting.
        </div>
        <ul v-else class="divide-y divide-ink-100">
          <li v-for="e in experimentsList.slice(0, 5)" :key="e.id" class="py-3 flex items-center justify-between">
            <div class="min-w-0">
              <div class="text-sm font-medium flex items-center gap-2">
                {{ e.name }}
                <span :class="badgeFor(e.status)">
                  <span v-if="e.status === 'running'" class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-soft" />
                  {{ e.status }}
                </span>
              </div>
              <div class="text-xs text-ink-500">{{ e.modelId }} · {{ formatDistanceToNow(e.createdAt) }}</div>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>