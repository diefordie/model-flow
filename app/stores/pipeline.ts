/**
 * Pipeline store.
 *
 * Holds the in-progress pipeline configuration (target, features,
 * preprocessing, model, hyperparameters, training) until the user
 * submits. Per PRD §7.3 the config lives client-side until submit,
 * then becomes the request body for `POST /projects/:id/experiments`.
 *
 * Resets when the project changes (so switching projects doesn't carry
 * a stale target/feature selection).
 */

import { defineStore } from 'pinia'
import type { PipelineConfig, TaskType, PreprocessingConfig, TrainingConfig } from '~/types/api'
import type { ModelEntry } from '~/data/mockModels'

const DEFAULT_PREPROCESSING: PreprocessingConfig = {
  missingValues: 'median',
  scaling: 'standard',
  encoding: 'onehot',
  testSize: 0.2,
  randomState: 42
}

const DEFAULT_TRAINING: TrainingConfig = {
  optimization: 'manual',
  cvFolds: 5,
  scoring: 'f1'
}

export const usePipelineStore = defineStore('pipeline', () => {
  const api = useApi()

  const datasetId = ref<string | null>(null)
  const taskType = ref<TaskType>('classification')
  const target = ref<string | null>(null)
  const features = ref<string[]>([])
  const preprocessing = ref<PreprocessingConfig>({ ...DEFAULT_PREPROCESSING })
  const training = ref<TrainingConfig>({ ...DEFAULT_TRAINING })
  const modelId = ref<string | null>(null)
  const hyperparameters = ref<Record<string, number | string | boolean>>({})

  const availableModels = ref<ModelEntry[]>([])
  const selectedModel = computed<ModelEntry | null>(() =>
    availableModels.value.find(m => m.id === modelId.value) ?? null
  )

  const isLoading = ref(false)
  const isSubmitting = ref(false)
  const error = ref<string | null>(null)

  /** Derived: full config ready for submission. */
  const config = computed<PipelineConfig | null>(() => {
    if (!datasetId.value || !modelId.value) return null
    return {
      taskType: taskType.value,
      target: target.value,
      features: features.value,
      preprocessing: preprocessing.value,
      modelId: modelId.value,
      hyperparameters: hyperparameters.value,
      training: training.value
    }
  })

  /** Whether the user can submit — basic completeness check. */
  const canSubmit = computed(() => {
    if (!datasetId.value || !modelId.value) return false
    if (taskType.value !== 'clustering' && !target.value) return false
    if (features.value.length === 0) return false
    return true
  })

  async function loadModelsFor(task: TaskType) {
    isLoading.value = true
    error.value = null
    try {
      const res = await api.listModels(task)
      availableModels.value = res.models
      // reset model selection if not in the new list
      if (modelId.value && !availableModels.value.find(m => m.id === modelId.value)) {
        modelId.value = null
        hyperparameters.value = {}
      }
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to load models'
      availableModels.value = []
    } finally {
      isLoading.value = false
    }
  }

  function setTaskType(t: TaskType) {
    taskType.value = t
    if (t === 'clustering') {
      target.value = null
      training.value.scoring = ''
    } else if (!training.value.scoring) {
      training.value.scoring = t === 'classification' ? 'f1' : 'rmse'
    }
    loadModelsFor(t)
  }

  function setDataset(id: string) {
    if (datasetId.value === id) return
    datasetId.value = id
    // reset selection that depended on previous dataset
    target.value = null
    features.value = []
  }

  function setTarget(col: string | null) {
    target.value = col
    if (col && features.value.includes(col)) {
      features.value = features.value.filter(f => f !== col)
    }
  }

  function toggleFeature(col: string) {
    if (target.value === col) return
    const i = features.value.indexOf(col)
    if (i === -1) features.value.push(col)
    else features.value.splice(i, 1)
  }

  function selectModel(id: string) {
    modelId.value = id
    // seed hyperparameters with the model's defaults
    const m = availableModels.value.find(x => x.id === id)
    if (m) {
      const seeded: Record<string, number | string | boolean> = {}
      for (const p of m.parameters) {
        if (p.default !== undefined) seeded[p.name] = p.default
      }
      hyperparameters.value = seeded
    }
  }

  function setHyperparam(name: string, value: number | string | boolean) {
    hyperparameters.value = { ...hyperparameters.value, [name]: value }
  }

  function reset() {
    datasetId.value = null
    taskType.value = 'classification'
    target.value = null
    features.value = []
    preprocessing.value = { ...DEFAULT_PREPROCESSING }
    training.value = { ...DEFAULT_TRAINING }
    modelId.value = null
    hyperparameters.value = {}
    availableModels.value = []
  }

  return {
    // state
    datasetId, taskType, target, features,
    preprocessing, training, modelId, hyperparameters,
    availableModels, selectedModel,
    // status
    isLoading, isSubmitting, error,
    // derived
    config, canSubmit,
    // actions
    loadModelsFor, setTaskType, setDataset, setTarget, toggleFeature,
    selectModel, setHyperparam, reset
  }
})