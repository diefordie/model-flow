/**
 * API client.
 *
 * Dual mode:
 *   1. `mock` (default) — pure in-memory fixtures, no auth required.
 *      Works in any environment; UI is exercisable end-to-end.
 *   2. `real` — proxied to the Hono backend at `/api/v1/*`. Requires
 *      a valid Supabase JWT in `useAuth().getToken()`. Endpoints the
 *      backend doesn't have yet (dashboards, insights, datasets) fall
 *      back to mock automatically with a console warning.
 *
 * Mode is controlled by `NUXT_PUBLIC_API_MODE` (env) or
 * `useRuntimeConfig().public.apiMode`. Default = `mock` so dev
 * iteration never accidentally hits the backend.
 *
 * Response shapes from the backend use snake_case + a different
 * envelope than the mock; `apiAdapter.ts` maps them to the camelCase
 * the stores expect.
 */

import type {
  Project,
  CreateProjectInput,
  Dataset,
  DatasetPreviewResponse,
  ColumnMeta,
  ExperimentSummary,
  ExperimentStatusResponse,
  ExperimentResults,
  Dashboard,
  DashboardWidget,
  InsightDescriptor,
  ApiError,
  TaskType,
  PipelineConfig,
  PredictionInput,
  PredictionResult
} from '~/types/api'

import { DATASETS, PROFILES, ROWS, TOTAL_ROWS } from '~/data/mockDatasets'
import { MODEL_REGISTRY, type ModelEntry } from '~/data/mockModels'
import {
  SEEDED_EXPERIMENTS,
  generateClassificationResults,
  generateRegressionResults
} from '~/data/mockExperiments'
import { resolveInsight, listInsights, SEEDED_DASHBOARDS } from '~/data/mockInsights'
import {
  adaptProject, adaptExperimentListItem, adaptStatus, adaptModelsResponse, adaptResults,
  adaptDataset, adaptExperimentFull, adaptInsightsResponse,
  type RealProject, type RealExperimentListItem, type RealStatus,
  type RealModelsResponse, type RealResults,
  type RealDataset, type RealExperimentFull, type RealInsightsResponse
} from './apiAdapter'

const USE_MOCK = true

// ── In-memory store ────────────────────────────────────────────────────
// Persisted across reloads via sessionStorage so dev iteration feels real.

interface MockState {
  projects: Project[]
  experiments: Record<string /* projectId */, ExperimentSummary[]>
  dashboards: Record<string /* projectId */, Dashboard[]>
}

function buildSeededDashboard(seed: typeof SEEDED_DASHBOARDS[number]): Dashboard {
  const now = new Date().toISOString()
  return {
    id: seed.id,
    projectId: seed.projectId,
    name: seed.name,
    description: seed.description,
    widgets: seed.widgets.map((w, i) => ({
      id: `${seed.id}_w${i}`,
      type: (w.insight === 'primary_metric' ? 'metric_card'
        : w.insight === 'metric_list' ? 'stat_table'
        : w.insight === 'confusion_matrix' ? 'confusion_matrix'
        : w.insight === 'roc_curve' ? 'roc_curve'
        : w.insight === 'residuals' ? 'scatter_chart'
        : w.insight === 'missing_values' ? 'bar_chart'
        : w.insight === 'feature_importance' ? 'bar_chart'
        : w.insight === 'correlation' ? 'heatmap'
        : w.insight === 'distribution' ? 'distribution'
        : w.insight === 'dataset_overview' ? 'stat_table'
        : 'bar_chart') as DashboardWidget['type'],
      title: w.insight.replace(/_/g, ' '),
      insight: w.insight,
      experimentId: w.experimentId,
      position: { x: w.x, y: w.y, width: w.width, height: w.height },
      data: undefined  // resolved on GET /dashboards/:id
    })),
    createdAt: now,
    updatedAt: now
  }
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
    },
    dashboards: SEEDED_DASHBOARDS.reduce<Record<string, Dashboard[]>>((acc, seed) => {
      acc[seed.projectId] = acc[seed.projectId] ?? []
      acc[seed.projectId].push(buildSeededDashboard(seed))
      return acc
    }, {})
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

/**
 * Endpoints the backend implements today. Only these go through the
 * real path. Anything else falls back to mock so the UI doesn't break
 * while the backend catches up to the PRD.
 */
const REAL_ENDPOINTS = new Set<string>([
  'GET /projects',
  'GET /projects/:id',
  'POST /projects',
  'GET /projects/:id/experiments',
  'POST /projects/:id/experiments',
  'GET /experiments/:id',
  'GET /experiments/:id/status',
  'GET /experiments/:id/results',
  'GET /projects/:id/datasets',
  'GET /projects/:id/dashboards',
  'GET /dashboards/:id',
  'POST /projects/:id/dashboards',
  'PATCH /dashboards/:id',
  'DELETE /dashboards/:id',
  'GET /projects/:id/insights',
  'GET /models',
  'POST /experiments/:id/predict'
])

function isRealEndpoint(method: string | undefined, path: string): boolean {
  const m = method ?? 'GET'
  const cleanPath = path.split('?')[0]!
  for (const pattern of REAL_ENDPOINTS) {
    const [pm, pp] = pattern.split(' ')
    if (pm !== m) continue
    if (pp === cleanPath) return true
    if (pp!.includes(':')) {
      const re = new RegExp('^' + pp!.replace(/:[^/]+/g, '[^/]+') + '$')
      if (re.test(cleanPath)) return true
    }
  }
  return false
}

export function useApi() {
  const config = useRuntimeConfig()
  const mode = (config.public.apiMode as string) || 'mock'
  const useReal = mode === 'real'

  function getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (import.meta.client) {
      try {
        const auth = useAuth()
        const token = auth.getToken()
        if (token) headers.Authorization = `Bearer ${token}`
      } catch { /* useAuth may not be available in setup without provider */ }
    }
    return headers
  }

  async function realFetch<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
    const res = await fetch(`/api/v1${path}`, {
      method: opts.method ?? 'GET',
      headers: getAuthHeaders(),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    })
    if (!res.ok) {
      const text = await res.text()
      throw err('HTTP_' + res.status, text || res.statusText)
    }
    if (res.status === 204) return undefined as unknown as T
    return await res.json() as T
  }

  async function request<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
    const method = opts.method ?? 'GET'
    if (useReal && isRealEndpoint(method, path)) {
      return realFetch<T>(path, opts)
    }
    return mockFetch<T>(path, opts)
  }

  // Adapter-aware wrappers (call the real API + adapt response)
  async function listProjectsReal(): Promise<Project[]> {
    const list = await realFetch<RealProject[]>('/projects')
    return list.map(adaptProject) as unknown as Project[]
  }
  async function getProjectReal(id: string): Promise<Project> {
    return adaptProject(await realFetch<RealProject>(`/projects/${id}`)) as unknown as Project
  }
  async function createProjectReal(input: CreateProjectInput): Promise<Project> {
    return adaptProject(await realFetch<RealProject>('/projects', { method: 'POST', body: input })) as unknown as Project
  }
  async function listExperimentsReal(projectId: string): Promise<ExperimentSummary[]> {
    const list = await realFetch<RealExperimentListItem[]>(`/projects/${projectId}/experiments`)
    return list.map(e => adaptExperimentListItem(e) as unknown as ExperimentSummary)
  }
  async function getExperimentStatusReal(id: string): Promise<ExperimentStatusResponse> {
    return adaptStatus(await realFetch<RealStatus>(`/experiments/${id}/status`)) as unknown as ExperimentStatusResponse
  }
  async function getExperimentResultsReal(id: string): Promise<ExperimentResults> {
    return adaptResults(await realFetch<RealResults>(`/experiments/${id}/results`)) as unknown as ExperimentResults
  }
  async function listModelsReal(task: TaskType): Promise<{ models: ModelEntry[] }> {
    return adaptModelsResponse(await realFetch<RealModelsResponse>(`/models?task=${task}`)) as unknown as { models: ModelEntry[] }
  }
  async function predictReal(experimentId: string, body: PredictionInput): Promise<PredictionResult> {
    return await realFetch<PredictionResult>(`/experiments/${experimentId}/predict`, { method: 'POST', body })
  }
  async function getExperimentReal(id: string): Promise<ExperimentSummary> {
    return adaptExperimentFull(await realFetch<RealExperimentFull>(`/experiments/${id}`)) as unknown as ExperimentSummary
  }
  async function listDatasetsReal(projectId: string): Promise<Dataset[]> {
    const list = await realFetch<RealDataset[]>(`/projects/${projectId}/datasets`)
    return list.map(adaptDataset) as unknown as Dataset[]
  }
  async function listDashboardsReal(projectId: string): Promise<Dashboard[]> {
    // backend returns raw Dashboard[]; same camelCase as frontend type — passthrough
    return await realFetch<Dashboard[]>(`/projects/${projectId}/dashboards`)
  }
  async function listInsightsReal(projectId: string, taskType?: TaskType): Promise<{ insights: InsightDescriptor[] }> {
    const q = taskType ? `?task=${taskType}` : ''
    return adaptInsightsResponse(await realFetch<RealInsightsResponse>(`/projects/${projectId}/insights${q}`))
  }

  return {
    listProjects:   useReal ? listProjectsReal : () => request<Project[]>('/projects'),
    getProject:     useReal ? getProjectReal : (id: string) => request<Project>(`/projects/${id}`),
    createProject:  useReal ? createProjectReal : (input: CreateProjectInput) => request<Project>('/projects', { method: 'POST', body: input }),
    deleteProject:  (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),

    listExperiments: useReal ? listExperimentsReal : (projectId: string) => request<ExperimentSummary[]>(`/projects/${projectId}/experiments`),
    getExperimentStatus: useReal ? getExperimentStatusReal : (id: string) => request<ExperimentStatusResponse>(`/experiments/${id}/status`),
    createExperiment: (projectId: string, body: PipelineConfig & { datasetId: string }) =>
      request<{ experimentId: string; status: 'queued' }>(`/projects/${projectId}/experiments`, { method: 'POST', body: {
        datasetId: body.datasetId,
        taskType: body.taskType,
        target: body.target,
        features: body.features,
        preprocessing: body.preprocessing,
        modelId: body.modelId,
        hyperparameters: body.hyperparameters,
        training: body.training
      } }),

    listDatasets:    useReal ? listDatasetsReal : (projectId: string) => request<Dataset[]>(`/projects/${projectId}/datasets`),
    getDataset:      (datasetId: string) => request<Dataset>(`/datasets/${datasetId}`),
    previewDataset:  (datasetId: string, page = 1, limit = 20) =>
      request<DatasetPreviewResponse>(`/datasets/${datasetId}/preview?page=${page}&limit=${limit}`),
    getDatasetProfile: (datasetId: string) => request<{ columns: ColumnMeta[] }>(`/datasets/${datasetId}/profile`),

    listModels:      useReal ? listModelsReal : (task: TaskType) => request<{ models: ModelEntry[] }>(`/models?task=${task}`),
    getDatasetColumns: (datasetId: string) => request<{ columns: ColumnMeta[] }>(`/datasets/${datasetId}/columns`),

    getExperiment: useReal ? getExperimentReal : (expId: string) =>
      request<ExperimentSummary>(`/experiments/${expId}`),
    getExperimentResults: useReal ? getExperimentResultsReal : (expId: string) =>
      request<ExperimentResults>(`/experiments/${expId}/results`),

    listDashboards: useReal ? listDashboardsReal : (projectId: string) =>
      request<Dashboard[]>(`/projects/${projectId}/dashboards`),
    getDashboard: (dashId: string) =>
      request<Dashboard>(`/dashboards/${dashId}`),
    createDashboard: (projectId: string, body: { name: string; description?: string; widgets?: DashboardWidget[] }) =>
      request<Dashboard>(`/projects/${projectId}/dashboards`, { method: 'POST', body }),
    updateDashboard: (dashId: string, body: Partial<Dashboard>) =>
      request<Dashboard>(`/dashboards/${dashId}`, { method: 'PATCH', body }),
    deleteDashboard: (dashId: string) =>
      request<void>(`/dashboards/${dashId}`, { method: 'DELETE' }),
    listInsights: useReal ? listInsightsReal : (projectId: string, taskType?: TaskType) =>
      request<{ insights: InsightDescriptor[] }>(`/projects/${projectId}/insights${taskType ? `?task=${taskType}` : ''}`),

    predict: useReal
      ? (experimentId: string, body: PredictionInput) => predictReal(experimentId, body)
      : (experimentId: string, body: PredictionInput) => request<PredictionResult>(`/experiments/${experimentId}/predict`, { method: 'POST', body }),

    mode: useReal ? 'real' as const : 'mock' as const
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

  // GET /projects/:projectId/dashboards
  const dashListMatch = path.match(/^\/projects\/([^/]+)\/dashboards$/)
  if (dashListMatch && (!opts.method || opts.method === 'GET')) {
    return (s.dashboards[dashListMatch[1]] ?? []) as unknown as T
  }

  // POST /projects/:projectId/dashboards
  if (dashListMatch && opts.method === 'POST') {
    const body = opts.body as { name: string; description?: string; widgets?: DashboardWidget[] }
    if (!body?.name) throw err('VALIDATION_ERROR', 'name is required')
    const id = uid('dash')
    const dash: Dashboard = {
      id,
      projectId: dashListMatch[1],
      name: body.name,
      description: body.description ?? '',
      widgets: body.widgets ?? [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    s.dashboards[dashListMatch[1]] = s.dashboards[dashListMatch[1]] ?? []
    s.dashboards[dashListMatch[1]].unshift(dash)
    persist()
    return dash as unknown as T
  }

  // GET /projects/:projectId/insights?task=...
  const insightsMatch = path.match(/^\/projects\/([^/]+)\/insights(?:\?.*)?$/)
  if (insightsMatch) {
    const url = new URL(path, 'http://x')
    const task = url.searchParams.get('task') as TaskType | null
    return { insights: listInsights(insightsMatch[1], task ?? undefined) } as unknown as T
  }

  // GET /dashboards/:id (resolves widget data)
  const dashGetMatch = path.match(/^\/dashboards\/([^/]+)$/)
  if (dashGetMatch && (!opts.method || opts.method === 'GET')) {
    for (const list of Object.values(s.dashboards)) {
      const dash = list.find(d => d.id === dashGetMatch[1])
      if (dash) {
        // resolve every widget's data based on its insight + experimentId
        const resolved: Dashboard = {
          ...dash,
          widgets: dash.widgets.map(w => {
            if (!w.experimentId && w.insight !== 'feature_importance' && w.insight !== 'confusion_matrix'
                && w.insight !== 'roc_curve' && w.insight !== 'residuals'
                && w.insight !== 'metric_list' && w.insight !== 'metric_card') {
              // dataset-level insight — use first dataset of the project
              const ds = DATASETS.find(d => d.projectId === dash.projectId)
              if (!ds) return w
              const ctx = { datasetId: ds.id, taskType: 'classification' as TaskType }
              const out = resolveInsight(w.insight, ctx)
              return out ? { ...w, data: out.data } : w
            }
            // experiment-level insight
            const exp = Object.values(s.experiments).flat().find(e => e.id === w.experimentId)
            if (!exp) return w
            const ds = DATASETS.find(d => d.projectId === dash.projectId)
            if (!ds) return w
            const ctx = { datasetId: ds.id, experimentId: w.experimentId, taskType: exp.taskType }
            const out = resolveInsight(w.insight, ctx)
            return out ? { ...w, data: out.data } : w
          })
        }
        return resolved as unknown as T
      }
    }
    throw err('NOT_FOUND', 'Dashboard not found')
  }

  // PATCH /dashboards/:id
  if (dashGetMatch && opts.method === 'PATCH') {
    const body = opts.body as Partial<Dashboard>
    for (const list of Object.values(s.dashboards)) {
      const dash = list.find(d => d.id === dashGetMatch[1])
      if (dash) {
        Object.assign(dash, body, { updatedAt: new Date().toISOString() })
        persist()
        return dash as unknown as T
      }
    }
    throw err('NOT_FOUND', 'Dashboard not found')
  }

  // DELETE /dashboards/:id
  if (dashGetMatch && opts.method === 'DELETE') {
    for (const list of Object.values(s.dashboards)) {
      const i = list.findIndex(d => d.id === dashGetMatch[1])
      if (i >= 0) {
        list.splice(i, 1)
        persist()
        return undefined as unknown as T
      }
    }
    throw err('NOT_FOUND', 'Dashboard not found')
  }

  // GET /projects/:projectId/experiments
  const expListMatch = path.match(/^\/projects\/([^/]+)\/experiments$/)
  if (expListMatch) {
    return (s.experiments[expListMatch[1]] ?? []) as unknown as T
  }

  // GET /experiments/:id (single experiment summary)
  const expMetaMatch = path.match(/^\/experiments\/([^/]+)$/)
  if (expMetaMatch) {
    for (const list of Object.values(s.experiments)) {
      const e = list.find(x => x.id === expMetaMatch[1])
      if (e) return e as unknown as T
    }
    throw err('NOT_FOUND', 'Experiment not found')
  }

  // GET /experiments/:id/results (mocked visualizations + metrics)
  const expResultsMatch = path.match(/^\/experiments\/([^/]+)\/results$/)
  if (expResultsMatch) {
    let exp: ExperimentSummary | undefined
    for (const list of Object.values(s.experiments)) {
      exp = list.find(x => x.id === expResultsMatch[1])
      if (exp) break
    }
    if (!exp) throw err('NOT_FOUND', 'Experiment not found')
    if (exp.status !== 'completed') {
      throw err('NOT_READY', 'Experiment is not yet completed')
    }
    // synthesize features from dataset profile if exp has no features attached
    const features = exp.taskType === 'classification'
      ? ['Glucose', 'BMI', 'Age', 'Pregnancies', 'BloodPressure', 'SkinHeight', 'Insulin', 'DiabetesPedigreeFunction']
      : ['OverallQual', 'GrLivArea', 'GarageCars', 'TotalBsmtSF', 'YearBuilt']
    return (exp.taskType === 'classification'
      ? generateClassificationResults(exp.id, features)
      : generateRegressionResults(exp.id, features)
    ) as unknown as T
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

  // ── Dataset routes ───────────────────────────────────────────────────

  // GET /projects/:projectId/datasets
  const dsListMatch = path.match(/^\/projects\/([^/]+)\/datasets$/)
  if (dsListMatch) {
    return DATASETS.filter(d => d.projectId === dsListMatch[1]) as unknown as T
  }

  // GET /datasets/:datasetId  (metadata only)
  const dsMetaMatch = path.match(/^\/datasets\/([^/]+)$/)
  if (dsMetaMatch) {
    const ds = DATASETS.find(d => d.id === dsMetaMatch[1])
    if (!ds) throw err('NOT_FOUND', 'Dataset not found')
    return ds as unknown as T
  }

  // GET /datasets/:datasetId/preview?page=&limit=
  const dsPreviewMatch = path.match(/^\/datasets\/([^/]+)\/preview(?:\?.*)?$/)
  if (dsPreviewMatch) {
    const id = dsPreviewMatch[1]
    const url = new URL(path, 'http://x')
    const page = parseInt(url.searchParams.get('page') ?? '1', 10)
    const limit = parseInt(url.searchParams.get('limit') ?? '20', 10)
    if (!PROFILES[id]) throw err('NOT_FOUND', 'Dataset not found')
    const allRows = ROWS[id] ?? []
    const total = TOTAL_ROWS[id] ?? allRows.length
    const start = (page - 1) * limit
    return {
      columns: PROFILES[id],
      rows: allRows.slice(start, start + limit),
      page,
      limit,
      totalRows: total
    } as unknown as T
  }

  // GET /datasets/:datasetId/profile
  const dsProfileMatch = path.match(/^\/datasets\/([^/]+)\/profile$/)
  if (dsProfileMatch) {
    const cols = PROFILES[dsProfileMatch[1]]
    if (!cols) throw err('NOT_FOUND', 'Dataset not found')
    return { columns: cols } as unknown as T
  }

  // GET /datasets/:datasetId/columns (alias — same shape as profile for now)
  const dsColMatch = path.match(/^\/datasets\/([^/]+)\/columns$/)
  if (dsColMatch) {
    const cols = PROFILES[dsColMatch[1]]
    if (!cols) throw err('NOT_FOUND', 'Dataset not found')
    return { columns: cols } as unknown as T
  }

  // GET /models?task=...
  const modelsMatch = path.match(/^\/models(?:\?.*)?$/)
  if (modelsMatch) {
    const url = new URL(path, 'http://x')
    const task = url.searchParams.get('task') as TaskType | null
    if (task && (task === 'classification' || task === 'regression' || task === 'clustering')) {
      return { models: MODEL_REGISTRY[task] } as unknown as T
    }
    return { models: [] } as unknown as T
  }

  // POST /projects/:projectId/experiments
  const createExpMatch = path.match(/^\/projects\/([^/]+)\/experiments$/)
  if (createExpMatch && opts.method === 'POST') {
    const body = opts.body as PipelineConfig & { datasetId: string }
    // backend validation (PRD §4.4 — minimal mock)
    if (!body.datasetId) throw err('VALIDATION_ERROR', 'datasetId is required')
    if (!body.taskType) throw err('VALIDATION_ERROR', 'taskType is required')
    if (body.taskType !== 'clustering' && !body.target) {
      throw err('VALIDATION_ERROR', 'target is required for supervised tasks')
    }
    if (!body.features?.length) throw err('VALIDATION_ERROR', 'at least one feature is required')
    if (!body.modelId) throw err('VALIDATION_ERROR', 'modelId is required')
    if (body.target && body.features.includes(body.target)) {
      throw err('INVALID_CONFIGURATION', 'target cannot also be a feature')
    }
    const s = loadState()
    const id = uid('exp')
    const exp: ExperimentSummary = {
      id,
      projectId: createExpMatch[1],
      name: body.modelId.replace(/_/g, ' '),
      taskType: body.taskType,
      modelId: body.modelId,
      status: 'queued',
      createdAt: new Date().toISOString(),
      durationMs: 0
    }
    s.experiments[createExpMatch[1]] = s.experiments[createExpMatch[1]] ?? []
    s.experiments[createExpMatch[1]].unshift(exp)
    persist()
    return { experimentId: id, status: 'queued' } as unknown as T
  }

  throw err('NOT_FOUND', `Mock route not implemented: ${path}`)
}