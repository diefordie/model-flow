<script setup lang="ts">
/**
 * `/projects/:id/pipeline` — ML configuration (Sprint 3).
 *
 * PRD §6.1: sequential configuration combining TaskSelector,
 * TargetSelector, FeatureSelector, PreprocessingForm, ModelSelector,
 * HyperparameterForm, TrainingConfig. Submitting calls
 * `POST /projects/:id/experiments`.
 *
 * UX: step-by-step reveal — each step shows when the previous one is
 * complete, so users don't face a wall of empty fields. Submitting
 * returns to the experiments list (Sprint 4 will pick that up).
 */
import TaskSelector from '~/components/pipeline/TaskSelector.vue'
import TargetSelector from '~/components/pipeline/TargetSelector.vue'
import FeatureSelector from '~/components/pipeline/FeatureSelector.vue'
import PreprocessingForm from '~/components/pipeline/PreprocessingForm.vue'
import ModelSelector from '~/components/pipeline/ModelSelector.vue'
import HyperparameterForm from '~/components/pipeline/HyperparameterForm.vue'
import TrainingConfig from '~/components/pipeline/TrainingConfig.vue'
import StepCard from '~/components/pipeline/StepCard.vue'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id as string)

const projectStore = useProjectStore()
const datasetStore = useDatasetStore()
const pipeline = usePipelineStore()

await useAsyncData(`pipeline-${projectId.value}`, async () => {
  await projectStore.fetchOne(projectId.value)
  await datasetStore.fetchAll(projectId.value)
  // auto-pick the first dataset
  if (datasetStore.activeDataset) {
    pipeline.setDataset(datasetStore.activeDataset.id)
  } else if (datasetStore.datasets.length > 0) {
    pipeline.setDataset(datasetStore.datasets[0].id)
  }
  await pipeline.loadModelsFor(pipeline.taskType)
  // default-select target for supervised tasks (user can override)
  if (pipeline.taskType !== 'clustering' && !pipeline.target && datasetStore.profile?.length) {
    // classification → first binary column, regression → first numeric
    const preferred = datasetStore.profile.find(c =>
      pipeline.taskType === 'classification'
        ? (c.dataType === 'binary' || c.dataType === 'categorical' || c.dataType === 'boolean')
        : c.dataType === 'numeric'
    )
    if (preferred) pipeline.setTarget(preferred.name)
  }
  // default-select all numeric features for a sensible starting point
  if (datasetStore.profile?.length) {
    const numeric = datasetStore.profile.filter(c => c.dataType === 'numeric').map(c => c.name)
    if (numeric.length && pipeline.features.length === 0) {
      // set via reassignment (not push) so reactive computeds re-evaluate in SSR
      pipeline.features = numeric
    }
  }
  return true
})

// Step gates — derived booleans to unlock each step
const step1Done = computed(() => !!pipeline.taskType)
const step2Done = computed(() => pipeline.taskType === 'clustering' ? pipeline.features.length > 0 : !!pipeline.target)
const step3Done = computed(() => pipeline.features.length > 0)
const step4Done = computed(() => !!pipeline.modelId)
const step5Done = computed(() => step4Done.value) // hyperparams always valid if model picked

const submitError = ref<string | null>(null)

async function submit() {
  submitError.value = null
  if (!pipeline.canSubmit || !pipeline.config || !pipeline.datasetId) return
  pipeline.isSubmitting = true
  try {
    const { experimentId } = await useApi().createExperiment(projectId.value, {
      ...pipeline.config,
      datasetId: pipeline.datasetId
    })
    await router.push(`/projects/${projectId.value}/experiments?created=${experimentId}`)
  } catch (e: any) {
    submitError.value = e?.message ?? 'Failed to create experiment'
  } finally {
    pipeline.isSubmitting = false
  }
}

const datasetsAvailable = computed(() => datasetStore.datasets.length > 0)
</script>

<template>
  <div v-if="projectStore.isLoading" class="p-8">
    <div class="h-8 w-48 bg-ink-200 rounded animate-pulse-soft mb-6" />
    <div class="h-4 w-96 bg-ink-100 rounded animate-pulse-soft mb-8" />
  </div>

  <div v-else-if="!projectStore.activeProject" class="p-8">
    <div class="surface p-6 border-danger/30 bg-red-50/40">
      <div class="text-sm font-medium text-red-700 mb-1">Project not found</div>
      <NuxtLink to="/projects" class="btn-ghost mt-2">← Back to projects</NuxtLink>
    </div>
  </div>

  <div v-else-if="!datasetsAvailable" class="p-8">
    <div class="surface p-10 text-center max-w-xl mx-auto">
      <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-ink-100 grid place-items-center">
        <svg viewBox="0 0 24 24" fill="none" class="w-5 h-5 text-ink-500"><path d="M3 16l5-5 4 4 7-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 8h5v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <h3 class="text-base font-semibold mb-1">Upload a dataset first</h3>
      <p class="text-sm text-ink-500 mb-4 max-w-sm mx-auto">
        A pipeline needs a dataset to configure against. Upload a CSV or XLSX to get started.
      </p>
      <NuxtLink :to="`/projects/${projectId}/dataset`" class="btn-primary">Go to dataset</NuxtLink>
    </div>
  </div>

  <div v-else class="max-w-4xl">
    <header class="px-8 pt-6 pb-4 border-b border-ink-200 bg-white">
      <NuxtLink :to="`/projects/${projectId}`" class="text-xs text-ink-500 hover:text-ink-900">← {{ projectStore.activeProject.name }}</NuxtLink>
      <div class="flex items-end justify-between mt-1 gap-4">
        <div>
          <h1 class="text-xl font-semibold tracking-tight">Pipeline configuration</h1>
          <p class="text-xs text-ink-500 mt-1">
            Dataset: <span class="font-medium text-ink-700">{{ datasetStore.activeDataset?.filename }}</span>
            · {{ datasetStore.activeDataset?.rows.toLocaleString() }} rows × {{ datasetStore.activeDataset?.columns }} cols
          </p>
        </div>
        <div v-if="pipeline.datasetId && datasetStore.datasets.length > 1" class="text-xs">
          <select
            :value="pipeline.datasetId"
            @change="(($event.target as HTMLSelectElement).value) && pipeline.setDataset(($event.target as HTMLSelectElement).value)"
            class="input h-8 text-xs"
          >
            <option v-for="d in datasetStore.datasets" :key="d.id" :value="d.id">{{ d.filename }}</option>
          </select>
        </div>
      </div>
    </header>

    <div class="p-8 space-y-5">
      <!-- Step 1: Task -->
      <StepCard step="1" title="Task" :done="step1Done" hint="What kind of prediction is this?">
        <TaskSelector
          :model-value="pipeline.taskType"
          @update:model-value="pipeline.setTaskType"
        />
      </StepCard>

      <!-- Step 2: Target -->
      <StepCard v-if="step1Done" step="2" title="Target column" :done="step2Done" hint="The column you want to predict.">
        <TargetSelector
          :model-value="pipeline.target"
          :columns="datasetStore.profile ?? []"
          :task-type="pipeline.taskType"
          @update:model-value="pipeline.setTarget"
        />
      </StepCard>

      <!-- Step 3: Features -->
      <StepCard v-if="step2Done" step="3" title="Features" :done="step3Done" hint="Columns the model will learn from.">
        <FeatureSelector
          :model-value="pipeline.features"
          :columns="datasetStore.profile ?? []"
          :target="pipeline.target"
          @update:model-value="(v) => pipeline.features = v"
        />
      </StepCard>

      <!-- Step 4: Preprocessing -->
      <StepCard v-if="step3Done" step="4" title="Preprocessing" :done="true" hint="How raw data gets transformed before training.">
        <PreprocessingForm
          :model-value="pipeline.preprocessing"
          @update:model-value="(v) => pipeline.preprocessing = v"
        />
      </StepCard>

      <!-- Step 5: Model -->
      <StepCard v-if="step3Done" step="5" title="Model" :done="step4Done" hint="Pick the algorithm. Backend registry decides what's available.">
        <div v-if="pipeline.isLoading" class="grid grid-cols-2 gap-2">
          <div v-for="i in 4" :key="i" class="h-20 bg-ink-100 rounded animate-pulse-soft" />
        </div>
        <ModelSelector
          v-else
          :model-value="pipeline.modelId"
          :models="pipeline.availableModels"
          @update:model-value="pipeline.selectModel"
        />
      </StepCard>

      <!-- Step 6: Hyperparameters (rendered dynamically from server schema) -->
      <StepCard v-if="step4Done" step="6" title="Hyperparameters" :done="step5Done" hint="Rendered dynamically from the model's schema — add a model server-side, no frontend changes needed.">
        <HyperparameterForm
          :parameters="pipeline.selectedModel?.parameters ?? []"
          :model-value="pipeline.hyperparameters"
          @update:model-value="(v) => pipeline.hyperparameters = v"
        />
      </StepCard>

      <!-- Step 7: Training config + submit -->
      <StepCard v-if="step5Done" step="7" title="Training" :done="pipeline.canSubmit" hint="Optimization method and the metric used to pick the best model.">
        <TrainingConfig
          :model-value="pipeline.training"
          :task-type="pipeline.taskType"
          @update:model-value="(v) => pipeline.training = v"
        />

        <div class="mt-6 pt-6 border-t border-ink-200 flex items-center gap-3">
          <button
            type="button"
            class="btn-primary"
            :disabled="!pipeline.canSubmit || pipeline.isSubmitting"
            @click="submit"
          >
            {{ pipeline.isSubmitting ? 'Creating experiment…' : 'Run experiment' }}
          </button>
          <div v-if="submitError" class="text-sm text-danger bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
            {{ submitError }}
          </div>
          <div v-else-if="!pipeline.canSubmit" class="text-xs text-ink-500">
            Complete every step to run.
          </div>
        </div>
      </StepCard>
    </div>
  </div>
</template>