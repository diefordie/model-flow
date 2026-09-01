/**
 * API client.
 *
 * Until the Hono backend + Supabase are wired (separate roles), this
 * composable serves a deterministic in-memory mock so the UI is
 * exercisable end-to-end. Switching to real backend is a one-line
 * change in `request()` — base URL flips to `/api/v1`.
 *
 * Mock latency is intentionally tiny (<200ms) so the loading states
 * still flash and can be visually verified.
 *
 * ponytail: in-memory mock. Swap when backend reports green by
 *   replacing `mockFetch` with a real `fetch` call to `/api/v1/...`.
 */

import type {
  Project,
  CreateProjectInput,
  DatasetPreviewResponse,
  ExperimentSummary,
  ExperimentStatusResponse,
  ApiError
} from '~/types/api'

const USE_MOCK = true

// ── In-memory store ────────────────────────────────────────────────────
// Persisted across reloads via sessionStorage so dev iteration feels real.

interface MockState {
  projects: Project[]
  experiments: Record<string /* projectId */, ExperimentSummary[]>
}

function seedState(): MockState {
  const now = Date.now()
  return {
    projects: [
      {
        id: 'proj_diabetes',
        name: 'Diabetes Prediction',
        description: 'Pima Indians Diabetes dataset — binary classification baseline',
        status: 'active',
        createdAt: new Date(now - 86_400_000 * 6).toISOString(),
        updatedAt: new Date(now - 3_600_000 * 4).toISOString(),
        counts: { datasets: 1, experiments: 3, dashboards: 1 }
      },
      {
        id: 'proj_housing',
        name: 'Housing Price Regression',
        description: 'Ames housing dataset, regression on SalePrice',
        status: 'active',
        createdAt: new Date(now - 86_400_000 * 3).toISOString(),
        updatedAt: new Date(now - 3_600_000 * 12).toISOString(),
        counts: { datasets: 1, experiments: 1, dashboards: 0 }
      }
    ],
    experiments: {
      proj_diabetes: [
        {
          id: 'exp_rf_v3', projectId: 'proj_diabetes', name: 'Random Forest v3',
          taskType: 'classification', modelId: 'random_forest_classifier',
          status: 'completed', createdAt: new Date(now - 86_400_000).toISOString(),
          durationMs: 38_000,
          primaryMetric: { name: 'F1', value: 0.824 }
        },
        {
          id: 'exp_lr_v1', projectId: 'proj_diabetes', name: 'Logistic Regression baseline',
          taskType: 'classification', modelId: 'logistic_regression',
          status: 'completed', createdAt: new Date(now - 86_400_000 * 2).toISOString(),
          durationMs: 4_200,
          primaryMetric: { name: 'F1', value: 0.765 }
        },
        {
          id: 'exp_dt_v1', projectId: 'proj_diabetes', name: 'Decision Tree',
          taskType: 'classification', modelId: 'decision_tree_classifier',
          status: 'failed', createdAt: new Date(now - 86_400_000 * 5).toISOString(),
          durationMs: 0
        }
      ],
      proj_housing: [
        {
          id: 'exp_linreg_v1', projectId: 'proj_housing', name: 'Linear Regression',
          taskType: 'regression', modelId: 'linear_regression',
          status: 'running', createdAt: new Date(now - 60_000 * 2).toISOString(),
          durationMs: 0
        }
      ]
    }
  }
}

let state: MockState | null = null

function loadState(): MockState {
  if (state) return state
  if (typeof window !== 'undefined') {
    const raw = sessionStorage.getItem('modelflow:mock-state')
    if (raw) {
      try { state = JSON.parse(raw); return state! } catch { /* fallthrough */ }
    }
  }
  state = seedState()
  if (typeof window !== 'undefined') sessionStorage.setItem('modelflow:mock-state', JSON.stringify(state))
  return state
}

function persist() {
  if (typeof window !== 'undefined' && state) {
    sessionStorage.setItem('modelflow:mock-state', JSON.stringify(state))
  }
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

const err = (code: string, message: string): ApiError => ({ code, message })

// ── Public API ─────────────────────────────────────────────────────────

export function useApi() {
  async function request<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
    if (USE_MOCK) return mockFetch<T>(path, opts)
    // real backend wiring — replace when Supabase + Hono are live
    const res = await fetch(`/api/v1${path}`, {
      method: opts.method ?? 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    })
    const json = await res.json()
    if (!json.success) throw json.error
    return json.data as T
  }

  return {
    listProjects:   () => request<Project[]>('/projects'),
    getProject:     (id: string) => request<Project>(`/projects/${id}`),
    createProject:  (input: CreateProjectInput) => request<Project>('/projects', { method: 'POST', body: input }),
    deleteProject:  (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),

    listExperiments:(projectId: string) => request<ExperimentSummary[]>(`/projects/${projectId}/experiments`),
    getExperimentStatus: (id: string) => request<ExperimentStatusResponse>(`/experiments/${id}/status`),

    previewDataset:  (datasetId: string, page = 1, limit = 20) =>
      request<DatasetPreviewResponse>(`/datasets/${datasetId}/preview?page=${page}&limit=${limit}`)
  }
}

// ── Mock fetch ─────────────────────────────────────────────────────────

async function mockFetch<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const s = loadState()
  await delay(120 + Math.random() * 180)

  // GET /projects
  if (path === '/projects' && (!opts.method || opts.method === 'GET')) {
    return [...s.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) as unknown as T
  }

  // POST /projects
  if (path === '/projects' && opts.method === 'POST') {
    const input = opts.body as CreateProjectInput
    if (!input.name?.trim()) throw err('VALIDATION_ERROR', 'Project name is required')
    const now = new Date().toISOString()
    const project: Project = {
      id: uid('proj'),
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      counts: { datasets: 0, experiments: 0, dashboards: 0 }
    }
    s.projects.unshift(project)
    s.experiments[project.id] = []
    persist()
    return project as unknown as T
  }

  // GET /projects/:id
  const projMatch = path.match(/^\/projects\/([^/]+)$/)
  if (projMatch && (!opts.method || opts.method === 'GET')) {
    const p = s.projects.find(p => p.id === projMatch[1])
    if (!p) throw err('NOT_FOUND', 'Project not found')
    return p as unknown as T
  }

  // DELETE /projects/:id
  if (projMatch && opts.method === 'DELETE') {
    s.projects = s.projects.filter(p => p.id !== projMatch[1])
    delete s.experiments[projMatch[1]]
    persist()
    return undefined as unknown as T
  }

  // GET /projects/:projectId/experiments
  const expListMatch = path.match(/^\/projects\/([^/]+)\/experiments$/)
  if (expListMatch) {
    return (s.experiments[expListMatch[1]] ?? []) as unknown as T
  }

  // GET /experiments/:id/status
  const expStatusMatch = path.match(/^\/experiments\/([^/]+)\/status$/)
  if (expStatusMatch) {
    for (const list of Object.values(s.experiments)) {
      const e = list.find(e => e.id === expStatusMatch[1])
      if (e) {
        // simulate running progress
        if (e.status === 'running') {
          e.primaryMetric = e.primaryMetric ?? { name: 'F1', value: 0 }
          return { status: 'running', stage: 'Training', progress: 65 } as unknown as T
        }
        return { status: e.status } as unknown as T
      }
    }
    throw err('NOT_FOUND', 'Experiment not found')
  }

  throw err('NOT_FOUND', `Mock route not implemented: ${path}`)
}