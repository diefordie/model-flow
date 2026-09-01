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

// ── Dashboards (Sprint 5) ──────────────────────────────────────────────

export type WidgetType =
  | 'metric_card' | 'metric_list'
  | 'bar_chart' | 'line_chart' | 'scatter_chart'
  | 'heatmap' | 'confusion_matrix' | 'roc_curve'
  | 'stat_table' | 'missing_values' | 'feature_importance'
  | 'distribution'

export interface WidgetPosition {
  x: number       // 0..11, 12-col grid
  y: number       // row
  width: number   // 1..12
  height: number  // row units (default 1)
}

export interface DashboardWidget {
  id: string
  type: WidgetType
  title: string
  /** Insight identifier — backend resolves this to widget data on dashboard fetch. */
  insight: string
  /** Source experiment (if widget references experiment results). */
  experimentId?: string
  position: WidgetPosition
  /** Backend-rendered widget payload — type depends on widgetType. */
  data?: unknown
}

export interface Dashboard {
  id: string
  projectId: string
  name: string
  description?: string
  widgets: DashboardWidget[]
  createdAt: string
  updatedAt: string
}

/** Subset of insights exposed by the backend (PRD §6.1 §5 — InsightSelector). */
export interface InsightDescriptor {
  key: string                // e.g. 'feature_importance'
  label: string              // e.g. 'Feature importance'
  category: 'dataset' | 'eda' | 'ml' | 'model_metrics'
  /** When true, this insight is compatible with the current task type. */
  available: boolean
}

// ── Experiment results (Sprint 4) ────────────────────────────────────

export type ClassificationMetrics = {
  accuracy: number
  precision: number
  recall: number
  f1: number
  rocAuc?: number
}

export type RegressionMetrics = {
  mae: number
  mse: number
  rmse: number
  r2: number
}

export type ClusteringMetrics = {
  silhouette: number
  inertia: number
  clusterSizes: number[]
}

/** Confusion matrix (rows = true class, cols = predicted class). */
export interface ConfusionMatrixData {
  classes: string[]
  matrix: number[][]
}

export interface RocCurveData {
  fpr: number[][]
  tpr: number[][]
  auc: number
}

export interface ResidualsData {
  predicted: number[]
  residuals: number[]
}

export interface ExperimentResults {
  metrics: ClassificationMetrics | RegressionMetrics | ClusteringMetrics
  visualizations: {
    confusionMatrix?: ConfusionMatrixData
    rocCurve?: RocCurveData
    residuals?: ResidualsData
    featureImportance?: Array<{ name: string; importance: number }>
    clusterSizes?: number[]
  }
  model: {
    id: string
    framework: string
    serialized: { sizeBytes: number; checksum: string }
    downloadUrl: string
  }
}

// ── Errors ─────────────────────────────────────────────────────────────

export interface ApiError {
  code: string
  message: string
}