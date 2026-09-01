<script setup lang="ts">
/**
 * /projects/:id/predictions/:expId — live prediction playground.
 *
 * Form fields are auto-generated from the experiment's feature_columns
 * (which the backend stores on the experiment row). Submit calls
 * POST /experiments/:id/predict; result is shown alongside the form.
 * Each run is appended to a session-local history so users can compare
 * results without leaving the page.
 */
import StatusBadge from '~/components/experiment/StatusBadge.vue'

const route = useRoute()
const projectId = computed(() => route.params.id as string)
const expId = computed(() => route.params.expId as string)
const api = useApi()
const projectStore = useProjectStore()
const expStore = useExperimentStore()

const { data: experiment } = await useAsyncData(`predict-exp-${expId.value}`, async () => {
  if (import.meta.client) {
    await projectStore.fetchOne(projectId.value)
    return await api.getExperiment(expId.value)
  }
  return null
})

const features = computed<string[]>(() => {
  const exp: any = experiment.value
  return exp?.featureColumns ?? []
})
const target = computed<string | null>(() => {
  const exp: any = experiment.value
  return exp?.targetColumn ?? null
})
const taskType = computed<string>(() => {
  const exp: any = experiment.value
  return exp?.taskType ?? 'classification'
})
const isClassification = computed(() => taskType.value === 'classification')

const form = reactive<Record<string, string>>({})
function seedForm() {
  for (const f of features.value) if (!(f in form)) form[f] = ''
}
watch(features, seedForm, { immediate: true })

const SAMPLE_PRESETS: Record<string, number> = {
  sepallength: 5.1, sepalwidth: 3.5, petallength: 1.4, petalwidth: 0.2
}
const fillSamplePossible = computed(() =>
  features.value.some(f => f in SAMPLE_PRESETS)
)
function fillSample() {
  let hit = 0
  for (const f of features.value) if (f in SAMPLE_PRESETS) { form[f] = String(SAMPLE_PRESETS[f]); hit++ }
  return hit > 0
}

const isRunning = ref(false)
const error = ref<string | null>(null)
interface HistoryEntry {
  input: Record<string, number | string>
  output: { prediction: number | string; probability?: number }
  at: number
}
const history = ref<HistoryEntry[]>([])

async function run() {
  error.value = null
  const featuresObj: Record<string, number | string> = {}
  for (const f of features.value) {
    const raw = (form[f] ?? '').trim()
    if (raw === '') {
      error.value = `Missing value for "${f}"`
      return
    }
    const num = Number(raw)
    featuresObj[f] = Number.isFinite(num) && raw !== '' ? num : raw
  }
  isRunning.value = true
  try {
    const result = await api.predict(expId.value, { features: featuresObj })
    history.value.unshift({ input: { ...featuresObj }, output: result, at: Date.now() })
    if (history.value.length > 20) history.value.pop()
  } catch (e: any) {
    error.value = e?.message ?? 'Prediction failed'
  } finally {
    isRunning.value = false
  }
}

function clearHistory() { history.value = [] }
function formatProb(p: number | undefined) {
  if (p === undefined || p === null) return '—'
  return `${(p * 100).toFixed(1)}%`
}
function relTime(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}
</script>

<template>
  <div v-if="!experiment" class="p-8">
    <div class="surface p-6 border-red-300/40 bg-red-50/40">
      <div class="text-sm font-medium text-red-700 mb-1">Experiment not found</div>
      <NuxtLink :to="`/projects/${projectId}/predictions`" class="btn-ghost mt-2">← Back to predictions</NuxtLink>
    </div>
  </div>
  <div v-else class="max-w-5xl mx-auto px-6 py-8">
    <NuxtLink :to="`/projects/${projectId}/predictions`" class="text-sm text-ink-500 hover:text-ink-900 transition-colors">
      ← Predictions
    </NuxtLink>
    <div class="mt-1 flex items-end justify-between flex-wrap gap-2">
      <div>
        <h1 class="text-xl font-semibold tracking-tight">{{ experiment.name }}</h1>
        <div class="text-sm text-ink-500 mt-1 flex items-center gap-2">
          <span class="capitalize">{{ taskType }}</span>
          <span v-if="target" class="text-ink-300">·</span>
          <span v-if="target">target = <span class="font-mono text-ink-700">{{ target }}</span></span>
          <span class="text-ink-300">·</span>
          <span>{{ features.length }} feature{{ features.length === 1 ? '' : 's' }}</span>
        </div>
      </div>
      <StatusBadge :status="experiment.status" />
    </div>

    <div v-if="experiment.status !== 'completed'" class="surface p-6 mt-6 border-amber-300/40 bg-amber-50/40">
      <div class="text-sm font-medium text-amber-800">This experiment isn't ready for predictions yet.</div>
      <p class="text-sm text-amber-700 mt-1">Status: {{ experiment.status }}. Wait for the model to finish training before running predictions.</p>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      <!-- LEFT: input form -->
      <div class="surface p-5">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold">Input features</h2>
          <button
            v-if="fillSamplePossible"
            type="button"
            @click="fillSample"
            class="text-xs text-ink-500 hover:text-ink-900 transition-colors"
          >Try sample</button>
        </div>
        <form @submit.prevent="run" class="space-y-3">
          <div v-for="f in features" :key="f">
            <label class="block text-xs font-medium text-ink-700 mb-1">
              <span class="font-mono">{{ f }}</span>
            </label>
            <input
              v-model="form[f]"
              type="text"
              inputmode="decimal"
              :placeholder="`Value for ${f}`"
              :disabled="isRunning"
              class="w-full px-3 py-2 rounded-md border border-ink-200 bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent disabled:opacity-50"
            />
          </div>
          <div v-if="features.length === 0" class="text-sm text-ink-500 italic">
            No feature columns recorded for this experiment.
          </div>
          <div v-if="error" class="text-sm text-red-600 mt-2">{{ error }}</div>
          <button
            type="submit"
            :disabled="isRunning || features.length === 0"
            class="btn-primary w-full mt-2"
          >
            <span v-if="isRunning" class="inline-flex items-center gap-2">
              <svg class="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" stroke-dasharray="42 18" stroke-linecap="round"/></svg>
              Running…
            </span>
            <span v-else>Run prediction</span>
          </button>
        </form>
      </div>

      <!-- RIGHT: result + history -->
      <div class="space-y-6">
        <div v-if="history[0]" class="surface p-5">
          <h2 class="text-sm font-semibold mb-3">Latest prediction</h2>
          <div class="flex items-baseline gap-3">
            <div class="text-3xl font-semibold tracking-tight">{{ history[0].output.prediction }}</div>
            <span v-if="isClassification && history[0].output.probability !== undefined" class="text-sm text-ink-500">
              {{ formatProb(history[0].output.probability) }} confidence
            </span>
          </div>
          <details class="mt-4">
            <summary class="text-xs text-ink-500 cursor-pointer hover:text-ink-900">Show input</summary>
            <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-mono">
              <template v-for="(v, k) in history[0].input" :key="k">
                <dt class="text-ink-500">{{ k }}</dt>
                <dd class="text-ink-900">{{ v }}</dd>
              </template>
            </dl>
          </details>
        </div>
        <div v-else class="surface p-5 text-sm text-ink-500 italic text-center">
          Fill in the features and hit <span class="text-ink-700 not-italic">Run prediction</span> to see the result here.
        </div>

        <div v-if="history.length > 1" class="surface p-5">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold">History</h2>
            <button @click="clearHistory" class="text-xs text-ink-500 hover:text-red-600 transition-colors">Clear</button>
          </div>
          <ul class="space-y-2">
            <li v-for="(h, i) in history.slice(1)" :key="i" class="text-sm flex items-center gap-3 py-1.5 border-b border-ink-100 last:border-0">
              <div class="font-semibold text-ink-900">{{ h.output.prediction }}</div>
              <span v-if="isClassification && h.output.probability !== undefined" class="text-xs text-ink-500">{{ formatProb(h.output.probability) }}</span>
              <span class="text-xs text-ink-400 ml-auto">{{ relTime(h.at) }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
