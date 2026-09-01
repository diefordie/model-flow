<script setup lang="ts">
/**
 * `/projects/:id/dashboards/:dashId` — Dashboard editor + viewer.
 *
 * PRD §6.1 §5 §07 §4:
 *   - Render widgets in 12-col grid
 *   - Edit mode: add widgets from InsightSelector, remove existing,
 *     save layout (PATCH)
 *   - View mode: read-only rendering
 *   - Backend delivers structured widget data; frontend renders
 */
import DashboardGrid from '~/components/dashboard/DashboardGrid.vue'
import InsightSelector from '~/components/dashboard/InsightSelector.vue'
import type { DashboardWidget, InsightDescriptor } from '~/types/api'

const route = useRoute()
const projectId = computed(() => route.params.id as string)
const dashId = computed(() => route.params.dashId as string)
const projectStore = useProjectStore()
const dashStore = useDashboardStore()
const expStore = useExperimentStore()

await useAsyncData(`dashboard-${dashId.value}`, async () => {
  await projectStore.fetchOne(projectId.value)
  await dashStore.fetchOne(dashId.value)
  // Insights are client-only (used only in editor); skip SSR to avoid
  // a Pinia hydration quirk when the data is fresh in store.
  return true
})

onMounted(() => {
  // Load insights + experiments list on the client (for the editor UI).
  dashStore.fetchInsights(projectId.value)
  loadExperiments()
})

const editing = ref(false)
const showAdd = ref(false)
const addingExperimentId = ref<string | null>(null)

const completedExperiments = computed(() =>
  expStore.summaries.filter(e => e.status === 'completed')
)

async function loadExperiments() {
  if (!expStore.summaries.length) {
    await expStore.fetchAll(projectId.value)
  }
}

watch(editing, (v) => {
  if (v) loadExperiments()
})

function addWidgetFromInsight(insight: InsightDescriptor) {
  if (!dashStore.activeDashboard) return
  // Place new widget at the next row below existing ones
  const maxY = Math.max(...dashStore.activeDashboard.widgets.map(w => w.position.y + w.position.height), 0)
  const widget: DashboardWidget = {
    id: uid(),
    type: (insight.key === 'primary_metric' ? 'metric_card'
      : insight.key === 'metric_list' ? 'stat_table'
      : insight.key === 'confusion_matrix' ? 'confusion_matrix'
      : insight.key === 'roc_curve' ? 'roc_curve'
      : insight.key === 'residuals' ? 'scatter_chart'
      : insight.key === 'missing_values' ? 'bar_chart'
      : insight.key === 'feature_importance' ? 'bar_chart'
      : insight.key === 'correlation' ? 'heatmap'
      : insight.key === 'distribution' ? 'distribution'
      : insight.key === 'dataset_overview' ? 'stat_table'
      : 'bar_chart') as DashboardWidget['type'],
    title: insight.label,
    insight: insight.key,
    experimentId: needsExperiment(insight.key) ? addingExperimentId.value ?? undefined : undefined,
    position: { x: 0, y: maxY, width: 4, height: 2 }
  }
  dashStore.addWidget(widget)
  showAdd.value = false
  addingExperimentId.value = null
}

function needsExperiment(insight: string): boolean {
  return ['feature_importance', 'confusion_matrix', 'roc_curve', 'residuals', 'metric_list', 'primary_metric'].includes(insight)
}

function uid() {
  return `w_${Math.random().toString(36).slice(2, 10)}`
}

async function saveLayout() {
  await dashStore.persistLayout()
  editing.value = false
}

async function deleteDashboard() {
  if (!confirm('Delete this dashboard? This cannot be undone.')) return
  await dashStore.remove(dashId.value)
  await navigateTo(`/projects/${projectId.value}/dashboards`)
}
</script>

<template>
  <div v-if="!dashStore.activeDashboard" class="p-8">
    <div class="surface p-6 border-red-300/40 bg-red-50/40">
      <div class="text-sm font-medium text-red-700 mb-1">Dashboard not found</div>
      <NuxtLink :to="`/projects/${projectId}/dashboards`" class="btn-ghost mt-2">← Back to dashboards</NuxtLink>
    </div>
  </div>

  <div v-else class="max-w-7xl">
    <!-- Header -->
    <header class="px-8 pt-6 pb-4 border-b border-ink-200 bg-white">
      <NuxtLink :to="`/projects/${projectId}/dashboards`" class="text-xs text-ink-500 hover:text-ink-900">← Dashboards</NuxtLink>
      <div class="flex items-end justify-between mt-1 gap-4">
        <div>
          <h1 class="text-xl font-semibold tracking-tight">{{ dashStore.activeDashboard.name }}</h1>
          <p v-if="dashStore.activeDashboard.description" class="text-xs text-ink-500 mt-1">{{ dashStore.activeDashboard.description }}</p>
          <p v-else class="text-xs text-ink-500 mt-1 font-mono">
            {{ dashStore.activeDashboard.widgets.length }} widgets · updated {{ new Date(dashStore.activeDashboard.updatedAt).toLocaleDateString() }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button v-if="!editing" class="btn-ghost text-sm border border-ink-200" @click="editing = true">Edit</button>
          <button v-else class="btn-ghost text-sm border border-ink-200" @click="editing = false">Cancel</button>
          <button v-if="editing" class="btn-primary text-sm" :disabled="dashStore.isSaving" @click="saveLayout">
            {{ dashStore.isSaving ? 'Saving…' : 'Save layout' }}
          </button>
          <button v-if="!editing" class="btn-ghost text-sm border border-ink-200 text-red-600 hover:bg-red-50" @click="deleteDashboard">
            Delete
          </button>
        </div>
      </div>
    </header>

    <div class="p-8 space-y-6">
      <!-- Grid -->
      <DashboardGrid
        :widgets="dashStore.activeDashboard.widgets"
        :editable="editing"
        @remove="(id) => dashStore.removeWidget(id)"
      />

      <!-- Add-widget panel (edit mode only) -->
      <section v-if="editing" class="surface p-5 border-dashed">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold">Add widget</h2>
          <button v-if="!showAdd" class="btn-ghost text-xs border border-ink-200" @click="showAdd = true">+ Add</button>
        </div>
        <div v-if="showAdd" class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Experiment picker (if user clicks an experiment-bound insight) -->
          <div v-if="completedExperiments.length">
            <h4 class="text-[10px] font-mono uppercase tracking-wider text-ink-400 mb-1.5">Source experiment (optional)</h4>
            <select v-model="addingExperimentId" class="input">
              <option :value="null">— none / dataset-level —</option>
              <option v-for="e in completedExperiments" :key="e.id" :value="e.id">
                {{ e.name }} ({{ e.taskType }})
              </option>
            </select>
          </div>
          <InsightSelector :insights="dashStore.availableInsights" @select="addWidgetFromInsight" />
        </div>
      </section>

      <!-- Empty state -->
      <div v-if="!dashStore.activeDashboard.widgets.length" class="surface p-10 text-center">
        <h3 class="text-base font-semibold mb-1">Empty dashboard</h3>
        <p class="text-sm text-ink-500 mb-4">{{ editing ? 'Add a widget from the panel below.' : 'Edit the dashboard to add widgets.' }}</p>
      </div>
    </div>
  </div>
</template>