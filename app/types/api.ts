/**
 * ModelFlow — shared TypeScript types matching the API contracts in
 * `04-api-reference.md` and the schema in `03-database-schema.md`.
 *
 * Frontend builds against these as the source of truth. Backend
 * (Hono + Supabase) is expected to return JSON that matches these
 * shapes — see `composables/useApi.ts` for the swap-to-real endpoint.
 */

// ── Projects ──────────────────────────────────────────────────────────

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived'

export interface Project {
  id: string
  name: string
  description?: string
  status: ProjectStatus
  createdAt: string
  updatedAt: string
  /** aggregate counts for the card UI */
  counts?: {
    datasets: number
    experiments: number
    dashboards: number
  }
}

export interface CreateProjectInput {
  name: string
  description?: string
}

// ── Datasets ───────────────────────────────────────────────────────────

export interface Dataset {
  id: string
  projectId: string
  filename: string
  sizeBytes: number
  rows: number
  columns: number
  uploadedAt: string
  status: 'ready' | 'processing' | 'failed'
}

export interface ColumnMeta {
  name: string
  dataType: 'numeric' | 'categorical' | 'datetime' | 'text' | 'boolean'
  missing: number
  unique?: number
}

export interface DatasetPreviewResponse {
  columns: ColumnMeta[]
  rows: Array<Record<string, unknown>>
  page: number
  limit: number
  totalRows: number
}

// ── Pipeline ───────────────────────────────────────────────────────────

export type MissingValueStrategy = 'drop' | 'mean' | 'median' | 'most_frequent' | 'constant'
export type ScalingStrategy = 'none' | 'standard' | 'minmax' | 'robust'
export type EncodingStrategy = 'onehot' | 'ordinal'
export type OptimizationMethod = 'manual' | 'grid' | 'random'

export interface PreprocessingConfig {
  missingValues: MissingValueStrategy
  scaling: ScalingStrategy
  encoding: EncodingStrategy
  testSize: number       // 0.0–1.0, default 0.2
  randomState: number
}

export interface TrainingConfig {
  optimization: OptimizationMethod
  cvFolds: number        // used for grid/random
  scoring: string        // metric id, see data/mockModels.ts §metricsForTask
}

export interface PipelineConfig {
  taskType: TaskType
  target: string | null    // null for clustering
  features: string[]
  preprocessing: PreprocessingConfig
  modelId: string
  hyperparameters: Record<string, number | string | boolean>
  training: TrainingConfig
}

// ── Experiments ────────────────────────────────────────────────────────

export type TaskType = 'classification' | 'regression' | 'clustering'
export type ExperimentStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface ExperimentSummary {
  id: string
  projectId: string
  name: string
  taskType: TaskType
  modelId: string
  status: ExperimentStatus
  createdAt: string
  durationMs?: number
  /** Top-line metric; differs per task type. */
  primaryMetric?: { name: string; value: number }
}

export interface ExperimentStatusResponse {
  status: ExperimentStatus
  stage?: string
  progress?: number
  errorCode?: string
  errorMessage?: string
}

// ── Errors ─────────────────────────────────────────────────────────────

export interface ApiError {
  code: string
  message: string
}