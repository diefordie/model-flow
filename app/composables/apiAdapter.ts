/**
 * Real-API adapter.
 *
 * The Hono backend (apps/api) returns snake_case + a different envelope
 * (no `{ success, data, error }` wrapper — just raw objects / arrays).
 * This module maps the backend's actual shape to the camelCase
 * shape the frontend stores/pages expect.
 *
 * Endpoints implemented in the backend (verified 2026-09-01):
 *   GET    /projects                          → Project[]
 *   GET    /projects/:id                      → Project
 *   POST   /projects                          → Project
 *   DELETE /projects/:id                      → void
 *   GET    /projects/:id/experiments          → ExperimentSummary[]
 *   POST   /projects/:id/experiments          → { experimentId, status }
 *   GET    /projects/:id/datasets             → 404 (NOT IMPLEMENTED)
 *   GET    /projects/:id/dashboards           → 404 (NOT IMPLEMENTED)
 *   GET    /projects/:id/insights             → 404 (NOT IMPLEMENTED)
 *   GET    /experiments/:id                   → 404 (NOT IMPLEMENTED)
 *   GET    /experiments/:id/status            → { status, stage, progress }
 *   GET    /experiments/:id/results           → { metrics, visualizations, model }
 *   POST   /experiments/:id/predictions       → { prediction, probability }
 *   GET    /models?task=X                     → { task, models: [...] }
 *
 * Endpoints the backend does NOT have yet (404 as of writing):
 *   - datasets list/get/preview/profile/columns
 *   - experiments list-by-id (only via project sub-route)
 *   - dashboards CRUD
 *   - insights catalog
 *
 * useApi will fall back to the in-memory mock for the missing routes.
 */

// ── Project adapter ────────────────────────────────────────────────────

export interface RealProject {
  id: number | string
  owner_id: string
  name: string
  description: string | null
  status: 'draft' | 'active' | 'archived'
  created_at: string
  updated_at: string
}

export function adaptProject(p: RealProject): {
  id: string
  ownerId: string
  name: string
  description: string | null
  status: 'active' | 'archived'
  createdAt: string
  updatedAt: string
} {
  return {
    id: String(p.id),
    ownerId: p.owner_id,
    name: p.name,
    description: p.description,
    status: p.status === 'archived' ? 'archived' : 'active',
    createdAt: p.created_at,
    updatedAt: p.updated_at
  }
}

// ── Experiment adapter ─────────────────────────────────────────────────

export interface RealExperimentListItem {
  id: number
  name: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  task_type: 'classification' | 'regression' | 'clustering'
  created_at: string
  completed_at: string | null
}

export function adaptExperimentListItem(e: RealExperimentListItem): {
  id: string
  projectId: string
  name: string
  taskType: 'classification' | 'regression' | 'clustering'
  modelId: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  createdAt: string
  durationMs: number
  primaryMetric: { name: string; value: number } | null
} {
  const startedMs = e.created_at ? new Date(e.created_at).getTime() : 0
  const endedMs = e.completed_at ? new Date(e.completed_at).getTime() : Date.now()
  return {
    id: String(e.id),
    projectId: '', // backend list endpoint doesn't include it
    name: e.name,
    taskType: e.task_type,
    modelId: '',   // not in list payload
    status: e.status,
    createdAt: e.created_at,
    durationMs: e.completed_at ? endedMs - startedMs : 0,
    primaryMetric: null
  }
}

export interface RealStatus {
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  stage: string | null
  progress: number
}

export function adaptStatus(s: RealStatus): {
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  stage: string | null
  progress: number
} {
  return s
}

// ── Models adapter ─────────────────────────────────────────────────────

export interface RealModelEntry {
  id: string
  name: string
  framework: string
  task: 'classification' | 'regression' | 'clustering'
  parameters: Array<{
    key: string
    label: string
    type: 'int' | 'float' | 'select' | 'bool'
    default: unknown
    options?: Array<{ label: string; value: string | number }>
    min?: number
    max?: number
    step?: number
  }>
}

export interface RealModelsResponse {
  task: 'classification' | 'regression' | 'clustering'
  models: RealModelEntry[]
}

export function adaptModelsResponse(r: RealModelsResponse): {
  models: Array<{
    id: string
    name: string
    framework: string
    task: 'classification' | 'regression' | 'clustering'
    parameters: RealModelEntry['parameters']
  }>
} {
  return { models: r.models }
}

// ── Results adapter ────────────────────────────────────────────────────

/** Real backend shape (snake_case + flat `model`):
 *  {
 *    metrics: { accuracy, precision, recall, f1 },
 *    visualizations: { confusion_matrix: { labels, matrix } } | null,
 *    featureImportance: [{ name, importance }] | null,
 *    model: { artifactPath, bytes, metadata: { model_type, best_params, ... } }
 *  }
 */
export interface RealResults {
  metrics: Record<string, number>
  visualizations: {
    confusion_matrix?: { labels: string[]; matrix: number[][] } | null
    roc_curve?: { auc: number; points: Array<{ fpr: number; tpr: number }> } | null
  } | null
  featureImportance: Array<{ name: string; importance: number }> | null
  model: {
    artifactPath: string
    bytes: number
    metadata: {
      model_type: string
      best_params?: Record<string, unknown>
      python_version?: string
      sklearn_version?: string
      cv_score?: number | null
    }
  }
}

export function adaptResults(r: RealResults): {
  metrics: Record<string, number>
  visualizations: {
    confusionMatrix?: { classes: string[]; matrix: number[][] } | null
    rocCurve?: { auc: number; points: Array<{ fpr: number; tpr: number }> } | null
    residuals?: { predicted: number[]; residuals: number[] } | null
  }
  featureImportance: Array<{ name: string; importance: number }> | null
  model: {
    id: string
    framework: string
    serialized: { sizeBytes: number; checksum: string }
    downloadUrl: string
  }
} {
  return {
    metrics: r.metrics,
    visualizations: r.visualizations ? {
      confusionMatrix: r.visualizations.confusion_matrix
        ? {
            classes: r.visualizations.confusion_matrix.labels,
            matrix: r.visualizations.confusion_matrix.matrix
          }
        : null,
      rocCurve: r.visualizations.roc_curve ?? null
    } : {},
    featureImportance: r.featureImportance,
    model: {
      id: r.model.metadata.model_type,
      framework: 'scikit-learn',
      serialized: {
        sizeBytes: r.model.bytes,
        checksum: '' // backend doesn't expose; UI shows "—" if empty
      },
      downloadUrl: r.model.artifactPath
    }
  }
}

// ── Dataset adapter ────────────────────────────────────────────────────

export interface RealDataset {
  id: number
  project_id: number
  owner_id: string
  name: string
  file_path: string
  file_type: 'csv' | 'parquet' | 'json'
  file_size: number
  row_count: number
  column_count: number
  /** Map of column name → primitive type. Backend uses lowercase
   *  `number`/`string`; our `Dataset` type uses `numeric`/`categorical`/`binary`. */
  schema: Record<string, 'number' | 'string' | 'boolean' | 'date'>
  created_at: string
}

const TYPE_MAP: Record<string, 'numeric' | 'categorical' | 'binary'> = {
  number: 'numeric',
  boolean: 'binary',
  string: 'categorical',
  date: 'categorical'
}

export function adaptDataset(d: RealDataset): {
  id: string
  projectId: string
  name: string
  fileType: 'csv' | 'parquet' | 'json'
  fileSize: number
  rowCount: number
  columnCount: number
  columns: Array<{ name: string; dataType: 'numeric' | 'categorical' | 'binary' }>
  createdAt: string
} {
  const columns = Object.entries(d.schema).map(([name, rawType]) => ({
    name,
    dataType: TYPE_MAP[rawType] ?? 'categorical'
  }))
  return {
    id: String(d.id),
    projectId: String(d.project_id),
    name: d.name,
    fileType: d.file_type,
    fileSize: d.file_size,
    rowCount: d.row_count,
    columnCount: d.column_count,
    columns,
    createdAt: d.created_at
  }
}

// ── Single experiment adapter ──────────────────────────────────────────

export interface RealExperimentFull {
  id: number
  project_id: number
  name: string
  task_type: 'classification' | 'regression' | 'clustering'
  target_column: string | null
  feature_columns: string[]
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  current_stage: string | null
  progress: number
  created_at: string
  completed_at: string | null
}

export function adaptExperimentFull(e: RealExperimentFull): {
  id: string
  projectId: string
  name: string
  taskType: 'classification' | 'regression' | 'clustering'
  targetColumn: string | null
  featureColumns: string[]
  modelId: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  currentStage: string | null
  progress: number
  createdAt: string
  completedAt: string | null
  durationMs: number
  primaryMetric: { name: string; value: number } | null
} {
  const startedMs = e.created_at ? new Date(e.created_at).getTime() : 0
  const endedMs = e.completed_at ? new Date(e.completed_at).getTime() : Date.now()
  return {
    id: String(e.id),
    projectId: String(e.project_id),
    name: e.name,
    taskType: e.task_type,
    targetColumn: e.target_column,
    featureColumns: e.feature_columns,
    modelId: '',
    status: e.status,
    currentStage: e.current_stage,
    progress: e.progress,
    createdAt: e.created_at,
    completedAt: e.completed_at,
    durationMs: e.completed_at ? endedMs - startedMs : 0,
    primaryMetric: null
  }
}

// ── Insight adapter ────────────────────────────────────────────────────

export interface RealInsightDescriptor {
  key: string
  label: string
  category: 'dataset' | 'eda' | 'ml' | 'model_metrics'
  available: boolean
}

export interface RealInsightsResponse {
  insights: RealInsightDescriptor[]
}

/** Insights endpoint already returns the camelCase shape we expect, so
 *  this is essentially a no-op — but keeping the adapter pattern means
 *  if Lunas renames a field, the only change is here, not in stores. */
export function adaptInsightsResponse(r: RealInsightsResponse): {
  insights: Array<{
    key: string
    label: string
    category: 'dataset' | 'eda' | 'ml' | 'model_metrics'
    available: boolean
  }>
} {
  return r
}
