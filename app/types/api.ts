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