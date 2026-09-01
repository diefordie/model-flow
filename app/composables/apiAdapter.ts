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

export interface RealResults {
  metrics: Record<string, number>
  visualizations: {
    confusionMatrix?: {
      classes: string[]
      matrix: number[][]
    } | null
    rocCurve?: { auc: number; points: Array<{ fpr: number; tpr: number }> } | null
    residuals?: { predicted: number[]; residuals: number[] } | null
  }
  featureImportance: Array<{ name: string; importance: number }> | null
  model: {
    id: string
    framework: string
    serialized: {
      sizeBytes: number
      checksum: string
    }
    downloadUrl: string
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
  return r
}
