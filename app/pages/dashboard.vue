<script setup lang="ts">
/**
 * Global dashboard.
 *
 * PRD §2.1 (`/dashboard`): total projects, recent projects, recent
 * experiments, latest model performance summary. Read-only — no config
 * actions here.
 */
import { formatDistanceToNow } from '~/utils/format'

const store = useProjectStore()
const api = useApi()

await useAsyncData('dashboard-init', async () => {
  await store.fetchAll()
  return true
})

// recent experiments = 4 most recent across all projects
const recentExperiments = ref<Array<{ id: string; name: string; projectName: string; modelId: string; status: string; createdAt: string }>>([])
onMounted(async () => {
  const results = await Promise.all(
    store.projects.slice(0, 5).map(async p => {
      try {
        const exps = await api.listExperiments(p.id)
        return exps.map(e => ({ ...e, projectName: p.name }))
      } catch { return [] }
    })
  )
  recentExperiments.value = results
    .flat()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)
})

const stats = computed(() => ({
  projects: store.projects.length,
  experiments: recentExperiments.value.length,
  running: recentExperiments.value.filter(e => e.status === 'running').length,
  failed: recentExperiments.value.filter(e => e.status === 'failed').length
}))

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
  <div class="p-8 max-w-6xl">
    <header class="mb-8">
      <p class="text-xs font-mono uppercase tracking-wider text-accent mb-1">Workspace</p>
      <h1 class="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p class="text-sm text-ink-500 mt-1">Your recent ML activity at a glance.</p>
    </header>

    <!-- Stats row -->
    <section class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-8">
      <div class="surface p-4">
        <div class="text-xs text-ink-500 font-mono uppercase tracking-wider">Projects</div>
        <div class="text-2xl font-semibold mt-1 tabular-nums">{{ stats.projects }}</div>
      </div>
      <div class="surface p-4">
        <div class="text-xs text-ink-500 font-mono uppercase tracking-wider">Recent experiments</div>
        <div class="text-2xl font-semibold mt-1 tabular-nums">{{ stats.experiments }}</div>
      </div>
      <div class="surface p-4">
        <div class="text-xs text-ink-500 font-mono uppercase tracking-wider">Running</div>
        <div class="text-2xl font-semibold mt-1 tabular-nums flex items-center gap-2">
          {{ stats.running }}
          <span v-if="stats.running > 0" class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-soft" />
        </div>
      </div>
      <div class="surface p-4">
        <div class="text-xs text-ink-500 font-mono uppercase tracking-wider">Failed</div>
        <div class="text-2xl font-semibold mt-1 tabular-nums">{{ stats.failed }}</div>
      </div>
    </section>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Recent projects -->
      <section class="surface p-5">
        <header class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold">Recent projects</h2>
          <NuxtLink to="/projects" class="text-xs text-accent hover:underline">View all →</NuxtLink>
        </header>
        <div v-if="store.isLoading" class="space-y-2">
          <div v-for="i in 3" :key="i" class="h-12 bg-ink-100 rounded animate-pulse-soft" />
        </div>
        <ul v-else-if="store.projects.length" class="space-y-1">
          <li v-for="p in store.projects.slice(0, 5)" :key="p.id">
            <NuxtLink
              :to="`/projects/${p.id}`"
              class="flex items-center justify-between p-2 -mx-2 rounded-md hover:bg-ink-100 transition-colors group"
            >
              <div class="min-w-0">
                <div class="text-sm font-medium truncate">{{ p.name }}</div>
                <div class="text-xs text-ink-500 truncate">{{ p.description ?? 'No description' }}</div>
              </div>
              <div class="text-xs text-ink-400 shrink-0 ml-3">{{ formatDistanceToNow(p.updatedAt) }}</div>
            </NuxtLink>
          </li>
        </ul>
        <div v-else class="text-center py-6">
          <div class="text-sm text-ink-500 mb-2">No projects yet.</div>
          <NuxtLink to="/projects/new" class="btn-primary">Create your first project</NuxtLink>
        </div>
      </section>

      <!-- Recent experiments -->
      <section class="surface p-5">
        <header class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold">Recent experiments</h2>
        </header>
        <div v-if="recentExperiments.length === 0 && !store.isLoading" class="text-sm text-ink-500 py-6 text-center">
          No experiments yet. Run one from inside a project.
        </div>
        <ul v-else class="space-y-1">
          <li v-for="e in recentExperiments" :key="e.id" class="flex items-center justify-between p-2 -mx-2 rounded-md hover:bg-ink-100 transition-colors">
            <div class="min-w-0">
              <div class="text-sm font-medium truncate flex items-center gap-2">
                {{ e.name }}
                <span :class="badgeFor(e.status)">
                  <span v-if="e.status === 'running'" class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-soft" />
                  {{ e.status }}
                </span>
              </div>
              <div class="text-xs text-ink-500 truncate">{{ e.projectName }} · {{ e.modelId }}</div>
            </div>
            <div class="text-xs text-ink-400 shrink-0 ml-3">{{ formatDistanceToNow(e.createdAt) }}</div>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>