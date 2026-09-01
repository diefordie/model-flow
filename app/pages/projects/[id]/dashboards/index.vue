<script setup lang="ts">
/**
 * `/projects/:id/dashboards` — Dashboard list.
 *
 * PRD §6.1 §5: shows all dashboards for the project. Click a card to
 * view/edit. "New dashboard" creates one and jumps straight into the
 * editor.
 */
const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id as string)
const projectStore = useProjectStore()
const dashStore = useDashboardStore()

await useAsyncData(`dashboards-${projectId.value}`, async () => {
  await Promise.all([
    projectStore.fetchOne(projectId.value),
    dashStore.fetchAll(projectId.value)
  ])
  return true
})

const showCreate = ref(false)
const newName = ref('')
const newDesc = ref('')

async function createAndOpen() {
  if (!newName.value.trim()) return
  const dash = await dashStore.create(projectId.value, newName.value.trim(), newDesc.value.trim())
  showCreate.value = false
  newName.value = ''
  newDesc.value = ''
  await router.push(`/projects/${projectId.value}/dashboards/${dash.id}`)
}

const counts = computed(() => ({
  total: dashStore.dashboards.length,
  widgets: dashStore.dashboards.reduce((n, d) => n + d.widgets.length, 0)
}))
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
          <h1 class="text-xl font-semibold tracking-tight">Dashboards</h1>
          <p class="text-xs text-ink-500 mt-1">{{ counts.total }} dashboards · {{ counts.widgets }} widgets total</p>
        </div>
        <button class="btn-primary text-sm" @click="showCreate = !showCreate">New dashboard</button>
      </div>
    </header>

    <!-- inline create form -->
    <div v-if="showCreate" class="px-8 pt-4">
      <div class="surface p-4 max-w-xl">
        <label class="label">Name</label>
        <input v-model="newName" type="text" class="input mb-3" placeholder="Diabetes — RF vs LR" @keydown.enter="createAndOpen" />
        <label class="label">Description (optional)</label>
        <textarea v-model="newDesc" rows="2" class="input mb-3" placeholder="What's this dashboard for?" />
        <div class="flex items-center gap-2">
          <button class="btn-primary text-sm" :disabled="!newName.trim() || dashStore.isSaving" @click="createAndOpen">
            {{ dashStore.isSaving ? 'Creating…' : 'Create' }}
          </button>
          <button class="btn-ghost text-sm" @click="showCreate = false">Cancel</button>
        </div>
      </div>
    </div>

    <div class="p-8">
      <!-- Empty -->
      <div v-if="!dashStore.dashboards.length && !showCreate" class="surface p-12 text-center max-w-xl mx-auto">
        <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-ink-100 grid place-items-center">
          <svg viewBox="0 0 24 24" fill="none" class="w-5 h-5 text-ink-500"><rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.5"/></svg>
        </div>
        <h3 class="text-base font-semibold mb-1">No dashboards yet</h3>
        <p class="text-sm text-ink-500 mb-4 max-w-sm mx-auto">Dashboards compose insights from your experiments — metrics, charts, and feature importance in one view.</p>
        <button class="btn-primary" @click="showCreate = true">Create your first dashboard</button>
      </div>

      <!-- List -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <NuxtLink
          v-for="d in dashStore.dashboards"
          :key="d.id"
          :to="`/projects/${projectId}/dashboards/${d.id}`"
          class="surface p-5 hover:shadow-lift hover:-translate-y-0.5 transition-all flex flex-col"
        >
          <h3 class="text-sm font-semibold mb-1">{{ d.name }}</h3>
          <p v-if="d.description" class="text-xs text-ink-500 mb-3 line-clamp-2">{{ d.description }}</p>
          <div class="mt-auto flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-ink-400">
            <span>{{ d.widgets.length }} widgets</span>
            <span>·</span>
            <span>{{ new Date(d.updatedAt).toLocaleDateString() }}</span>
          </div>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>