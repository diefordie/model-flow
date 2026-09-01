<script setup lang="ts">
/**
 * `/projects/:id/experiments/:expId` — Experiment detail.
 *
 * PRD §6.1 §4 §07:
 *   - Status + stage progress (live when running)
 *   - Metrics panel (task-specific)
 *   - Visualizations (confusion matrix, ROC, residuals, feature importance)
 *   - Model artifact download
 */
import StatusBadge from '~/components/experiment/StatusBadge.vue'
import MetricCard from '~/components/experiment/MetricCard.vue'
import ConfusionMatrix from '~/components/experiment/ConfusionMatrix.vue'
import RocCurve from '~/components/experiment/RocCurve.vue'
import Residuals from '~/components/experiment/Residuals.vue'
import FeatureImportance from '~/components/experiment/FeatureImportance.vue'

const route = useRoute()
const projectId = computed(() => route.params.id as string)
const expId = computed(() => route.params.expId as string)
const projectStore = useProjectStore()
const expStore = useExperimentStore()

await useAsyncData(`exp-${expId.value}`, async () => {
  await Promise.all([
    projectStore.fetchOne(projectId.value),
    expStore.fetchOne(expId.value)
  ])
  // Fetch results server-side too, so SSR renders full detail page
  // (avoids "loading flash" when the page hydrates)
  if (expStore.activeSummary?.status === 'completed') {
    await expStore.fetchResults(expId.value)
  }
  return true
})

// Live status polling: 2s while running or queued
let pollHandle: ReturnType<typeof setInterval> | null = null
const liveStage = ref<string | null>(null)
const liveProgress = ref<number | null>(null)

onMounted(() => {
  pollHandle = setInterval(async () => {
    if (document.hidden) return
    if (!expStore.activeSummary) return
    if (!['queued', 'running'].includes(expStore.activeSummary.status)) return
    const status = await expStore.fetchStatus(expId.value)
    if (!status) return
    liveStage.value = status.stage ?? null
    liveProgress.value = status.progress ?? null
    if (status.status !== expStore.activeSummary.status) {
      expStore.activeSummary.status = status.status
    }
    // when completed, fetch results
    if (status.status === 'completed' && !expStore.activeResults) {
      await expStore.fetchResults(expId.value)
    }
  }, 2000)
})
onBeforeUnmount(() => {
  if (pollHandle) clearInterval(pollHandle)
})

// Initial results fetch if already completed
onMounted(async () => {
  if (expStore.activeSummary?.status === 'completed' && !expStore.activeResults) {
    await expStore.fetchResults(expId.value)
  }
})

const isClassification = computed(() => expStore.activeSummary?.taskType === 'classification')
const isRegression = computed(() => expStore.activeSummary?.taskType === 'regression')

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function isMetrics(m: any): m is { accuracy: number; precision: number; recall: number; f1: number; rocAuc?: number } {
  return 'accuracy' in m
}
function isRegMetrics(m: any): m is { mae: number; mse: number; rmse: number; r2: number } {
  return 'mae' in m
}
</script>

<template>
  <div v-if="!expStore.activeSummary" class="p-8">
    <div class="surface p-6 border-red-300/40 bg-red-50/40">
      <div class="text-sm font-medium text-red-700 mb-1">Experiment not found</div>
      <NuxtLink :to="`/projects/${projectId}/experiments`" class="btn-ghost mt-2">← Back to experiments</NuxtLink>
    </div>
  </div>

  <div v-else class="max-w-5xl">
    <!-- Header -->
    <header class="px-8 pt-6 pb-4 border-b border-ink-200 bg-white">
      <NuxtLink :to="`/projects/${projectId}/experiments`" class="text-xs text-ink-500 hover:text-ink-900">← Experiments</NuxtLink>
      <div class="flex items-end justify-between mt-1 gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl font-semibold tracking-tight">{{ expStore.activeSummary.name }}</h1>
            <StatusBadge :status="expStore.activeSummary.status" />
          </div>
          <p class="text-xs text-ink-500 mt-1 font-mono">
            {{ expStore.activeSummary.modelId.replace(/_/g, ' ') }}
            · <span class="capitalize">{{ expStore.activeSummary.taskType }}</span>
            · {{ expStore.activeSummary.id }}
          </p>
        </div>
        <!-- Stage + progress while running -->
        <div v-if="expStore.activeSummary.status === 'running' || expStore.activeSummary.status === 'queued'" class="text-right">
          <div class="text-[10px] font-mono uppercase tracking-wider text-ink-500">{{ liveStage ?? 'starting…' }}</div>
          <div class="text-sm font-semibold tabular-nums">{{ liveProgress ?? 0 }}%</div>
          <div class="w-32 h-1.5 mt-1 bg-ink-100 rounded-full overflow-hidden">
            <div class="h-full bg-accent transition-all" :style="{ width: `${liveProgress ?? 0}%` }" />
          </div>
        </div>
      </div>
    </header>

    <div class="p-8 space-y-6">
      <!-- Metrics -->
      <section v-if="expStore.activeResults" class="space-y-3">
        <h2 class="text-sm font-semibold">Metrics</h2>
        <div v-if="isMetrics(expStore.activeResults.metrics)" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <MetricCard label="Accuracy"  :value="expStore.activeResults.metrics.accuracy" primary />
          <MetricCard label="Precision" :value="expStore.activeResults.metrics.precision" />
          <MetricCard label="Recall"    :value="expStore.activeResults.metrics.recall" />
          <MetricCard label="F1 Score"  :value="expStore.activeResults.metrics.f1" />
          <MetricCard label="ROC-AUC"   :value="expStore.activeResults.metrics.rocAuc ?? 0" />
        </div>
        <div v-else-if="isRegMetrics(expStore.activeResults.metrics)" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="MAE"  :value="expStore.activeResults.metrics.mae"  unit="$" />
          <MetricCard label="MSE"  :value="expStore.activeResults.metrics.mse"  unit="²" />
          <MetricCard label="RMSE" :value="expStore.activeResults.metrics.rmse" unit="$" />
          <MetricCard label="R²"   :value="expStore.activeResults.metrics.r2" primary />
        </div>
      </section>

      <!-- Visualizations -->
      <section v-if="expStore.activeResults" class="space-y-3">
        <h2 class="text-sm font-semibold">Visualizations</h2>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div v-if="isClassification && expStore.activeResults.visualizations.confusionMatrix" class="surface p-5">
            <h3 class="text-xs font-semibold mb-3">Confusion matrix</h3>
            <ConfusionMatrix :data="expStore.activeResults.visualizations.confusionMatrix" />
          </div>
          <div v-if="isClassification && expStore.activeResults.visualizations.rocCurve" class="surface p-5">
            <h3 class="text-xs font-semibold mb-3">ROC curve</h3>
            <RocCurve :data="expStore.activeResults.visualizations.rocCurve" />
          </div>
          <div v-if="isRegression && expStore.activeResults.visualizations.residuals" class="surface p-5">
            <h3 class="text-xs font-semibold mb-3">Residuals vs predicted</h3>
            <Residuals :data="expStore.activeResults.visualizations.residuals" />
          </div>
          <div v-if="expStore.activeResults.visualizations.featureImportance" class="surface p-5">
            <h3 class="text-xs font-semibold mb-3">Feature importance</h3>
            <FeatureImportance :data="expStore.activeResults.visualizations.featureImportance" />
          </div>
        </div>
      </section>

      <!-- Model artifact -->
      <section v-if="expStore.activeResults" class="surface p-5">
        <h2 class="text-sm font-semibold mb-3">Model artifact</h2>
        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="text-xs font-mono text-ink-700">{{ expStore.activeResults.model.id }}</div>
            <div class="text-xs text-ink-500 mt-0.5">
              {{ expStore.activeResults.model.framework }}
              · {{ fmtBytes(expStore.activeResults.model.serialized.sizeBytes) }}
              · <span class="text-ink-400">{{ expStore.activeResults.model.serialized.checksum.slice(0, 16) }}…</span>
            </div>
          </div>
          <a :href="expStore.activeResults.model.downloadUrl" class="btn-ghost border border-ink-200 text-sm">
            Download
            <svg viewBox="0 0 16 16" fill="none" class="w-3 h-3 ml-1.5"><path d="M8 2v8m0 0l-3-3m3 3l3-3M2 13h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </a>
        </div>
      </section>

      <!-- Loading state -->
      <div v-if="expStore.activeSummary.status === 'running' || expStore.activeSummary.status === 'queued'" class="surface p-8 text-center">
        <div class="inline-flex items-center gap-2 text-sm text-ink-600">
          <span class="w-2 h-2 rounded-full bg-accent animate-pulse-soft" />
          {{ expStore.activeSummary.status === 'queued' ? 'Waiting for worker…' : 'Training in progress' }}
        </div>
        <p class="text-xs text-ink-500 mt-2">Metrics and visualizations will appear here when training finishes.</p>
      </div>
    </div>
  </div>
</template>