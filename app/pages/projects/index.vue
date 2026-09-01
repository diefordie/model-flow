<script setup lang="ts">
/**
 * `/projects` — Project list.
 *
 * PRD §6.1: list with ProjectCard per project (name, status, updated
 * date). Empty state when no projects exist yet (see PRD §3 below).
 *
 * Every async operation here must show loading/empty/error/success
 * (PRD §8.3 / §3).
 */
import { formatDistanceToNow } from '~/utils/format'

const store = useProjectStore()
await useAsyncData('projects-list', async () => { await store.fetchAll(); return true })

const filter = ref<'all' | 'active' | 'paused' | 'completed' | 'archived'>('all')
const filtered = computed(() =>
  filter.value === 'all' ? store.projects : store.projects.filter(p => p.status === filter.value)
)

const counts = computed(() => ({
  all: store.projects.length,
  active: store.projects.filter(p => p.status === 'active').length,
  paused: store.projects.filter(p => p.status === 'paused').length,
  completed: store.projects.filter(p => p.status === 'completed').length,
  archived: store.projects.filter(p => p.status === 'archived').length
}))
</script>

<template>
  <div class="p-8 max-w-6xl">
    <header class="flex items-end justify-between mb-6 gap-4">
      <div>
        <p class="text-xs font-mono uppercase tracking-wider text-accent mb-1">Workspace</p>
        <h1 class="text-2xl font-semibold tracking-tight">Projects</h1>
        <p class="text-sm text-ink-500 mt-1">Each project holds its own dataset, experiments, and dashboards.</p>
      </div>
      <NuxtLink to="/projects/new" class="btn-primary">+ New project</NuxtLink>
    </header>

    <!-- Status filter -->
    <nav class="flex items-center gap-1 mb-5 border-b border-ink-200">
      <button
        v-for="(label, key) in { all: 'All', active: 'Active', paused: 'Paused', completed: 'Completed', archived: 'Archived' }"
        :key="key"
        @click="filter = key as any"
        :class="[
          'px-3 h-10 -mb-px text-sm font-medium border-b-2 transition-colors',
          filter === key
            ? 'border-accent text-ink-900'
            : 'border-transparent text-ink-500 hover:text-ink-900'
        ]"
      >
        {{ label }}
        <span class="ml-1 text-xs text-ink-400 tabular-nums">{{ counts[key] }}</span>
      </button>
    </nav>

    <!-- States -->
    <div v-if="store.isLoading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="i in 3" :key="i" class="surface p-5 h-36 animate-pulse-soft" />
    </div>

    <div v-else-if="store.error" class="surface p-6 border-danger/30 bg-red-50/40">
      <div class="text-sm font-medium text-red-700 mb-1">Couldn't load projects</div>
      <div class="text-sm text-red-600/90 mb-3">{{ store.error }}</div>
      <button class="btn-ghost border border-red-200" @click="store.fetchAll()">Retry</button>
    </div>

    <div v-else-if="filtered.length === 0 && store.projects.length === 0" class="surface p-10 text-center">
      <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-ink-100 grid place-items-center">
        <svg viewBox="0 0 24 24" fill="none" class="w-5 h-5 text-ink-500"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" stroke-width="1.5"/></svg>
      </div>
      <h3 class="text-base font-semibold mb-1">No projects yet</h3>
      <p class="text-sm text-ink-500 mb-4 max-w-sm mx-auto">
        A project groups a dataset, experiments, and dashboards. Start by creating one.
      </p>
      <NuxtLink to="/projects/new" class="btn-primary">Create your first project</NuxtLink>
    </div>

    <div v-else-if="filtered.length === 0" class="text-center py-12 text-sm text-ink-500">
      No projects match this filter.
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <NuxtLink
        v-for="p in filtered"
        :key="p.id"
        :to="`/projects/${p.id}`"
        class="surface p-5 hover:shadow-lift hover:-translate-y-0.5 transition-all group flex flex-col"
      >
        <div class="flex items-start justify-between gap-3 mb-2">
          <h3 class="text-sm font-semibold truncate group-hover:text-accent transition-colors min-w-0 flex-1">{{ p.name }}</h3>
          <span :class="{
            'badge-success shrink-0': p.status === 'active',
            'badge-warning shrink-0': p.status === 'paused',
            'badge-neutral shrink-0': p.status === 'completed' || p.status === 'archived'
          }">{{ p.status }}</span>
        </div>
        <p class="text-sm text-ink-500 line-clamp-2 mb-4 min-h-10 flex-1">{{ p.description || 'No description.' }}</p>
        <div class="flex items-center gap-4 text-xs text-ink-500 pt-3 border-t border-ink-100">
          <span class="flex items-center gap-1">
            <svg viewBox="0 0 16 16" fill="none" class="w-3.5 h-3.5"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M2 6h12" stroke="currentColor" stroke-width="1.5"/></svg>
            {{ p.counts?.datasets ?? 0 }} datasets
          </span>
          <span class="flex items-center gap-1">
            <svg viewBox="0 0 16 16" fill="none" class="w-3.5 h-3.5"><path d="M3 12l3-4 3 2 4-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            {{ p.counts?.experiments ?? 0 }} exp
          </span>
          <span class="ml-auto">{{ formatDistanceToNow(p.updatedAt) }}</span>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>