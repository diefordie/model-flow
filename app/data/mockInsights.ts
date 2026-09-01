/**
 * Insight resolver (Sprint 5).
 *
 * Per PRD §07 §5, the InsightSelector presents backend-defined insights.
 * Per §07 §11, compatibility is **data from the backend** — never a
 * frontend if/else chain. So this module exposes:
 *
 *   listInsights(projectId, taskType)  → InsightDescriptor[]
 *   resolveInsight(insight, ctx)       → widget data
 *
 * Both are intentionally generic — the backend can later ship a new
 * insight key, register it here, and it just works.
 */

import type { InsightDescriptor, TaskType } from '~/types/api'
import { PROFILES, TOTAL_ROWS, ROWS } from '~/data/mockDatasets'
import {
  generateClassificationResults,
  generateRegressionResults
} from '~/data/mockExperiments'

// ── Catalog ────────────────────────────────────────────────────────────

interface InsightDef {
  key: string
  label: string
  category: 'dataset' | 'eda' | 'ml' | 'model_metrics'
  /** Which task types the insight is compatible with. */
  taskTypes: TaskType[] | 'all'
  /** Path into a context object (project/experiment) to resolve data. */
  resolver: 'dataset_overview' | 'correlation' | 'feature_importance'
    | 'confusion_matrix' | 'roc_curve' | 'residuals'
    | 'metric_list' | 'missing_values' | 'distribution'
    | 'metric_card'
}

const CATALOG: InsightDef[] = [
  // ── Dataset ──
  { key: 'dataset_overview',    label: 'Dataset overview',     category: 'dataset', taskTypes: 'all', resolver: 'dataset_overview' },
  { key: 'missing_values',      label: 'Missing values',       category: 'dataset', taskTypes: 'all', resolver: 'missing_values' },
  // ── EDA ──
  { key: 'correlation',         label: 'Correlation matrix',   category: 'eda',     taskTypes: 'all', resolver: 'correlation' },
  { key: 'distribution',        label: 'Feature distribution', category: 'eda',     taskTypes: 'all', resolver: 'distribution' },
  // ── ML ──
  { key: 'feature_importance',  label: 'Feature importance',   category: 'ml',      taskTypes: ['classification', 'regression'], resolver: 'feature_importance' },
  { key: 'confusion_matrix',    label: 'Confusion matrix',     category: 'ml',      taskTypes: ['classification'],                resolver: 'confusion_matrix' },
  { key: 'roc_curve',           label: 'ROC curve',            category: 'ml',      taskTypes: ['classification'],                resolver: 'roc_curve' },
  { key: 'residuals',           label: 'Residuals vs predicted', category: 'ml',    taskTypes: ['regression'],                   resolver: 'residuals' },
  // ── Model metrics ──
  { key: 'metric_list',         label: 'All metrics',          category: 'model_metrics', taskTypes: ['classification', 'regression'], resolver: 'metric_list' },
  { key: 'primary_metric',      label: 'Primary metric',       category: 'model_metrics', taskTypes: ['classification', 'regression'], resolver: 'metric_card' },
]

export function listInsights(_projectId: string, taskType?: TaskType): InsightDescriptor[] {
  return CATALOG
    .filter(def => def.taskTypes === 'all' || (taskType && def.taskTypes.includes(taskType)))
    .map(def => ({
      key: def.key,
      label: def.label,
      category: def.category,
      available: true
    }))
}

// ── Resolver context ───────────────────────────────────────────────────

export interface ResolveContext {
  datasetId: string
  experimentId?: string
  taskType?: TaskType
}

// ── Resolver ───────────────────────────────────────────────────────────

export function resolveInsight(insight: string, ctx: ResolveContext): { widgetType: string; data: unknown } | null {
  const def = CATALOG.find(d => d.key === insight)
  if (!def) return null

  switch (def.resolver) {
    case 'dataset_overview':
      return {
        widgetType: 'stat_table',
        data: {
          columns: ['Column', 'Type', 'Missing', 'Unique'],
          rows: (PROFILES[ctx.datasetId] ?? []).map(c => [
            c.name,
            c.dataType,
            c.missing.toLocaleString(),
            c.unique?.toLocaleString() ?? '—'
          ])
        }
      }

    case 'missing_values': {
      const cols = PROFILES[ctx.datasetId] ?? []
      return {
        widgetType: 'bar_chart',
        data: cols
          .filter(c => c.missing > 0)
          .map(c => ({ name: c.name, value: c.missing }))
          .sort((a, b) => b.value - a.value)
      }
    }

    case 'correlation': {
      // synthesize correlation matrix for numeric columns of the dataset
      const cols = (PROFILES[ctx.datasetId] ?? []).filter(c => c.dataType === 'numeric')
      const names = cols.map(c => c.name)
      const matrix = names.map((_, i) => names.map((_, j) => {
        if (i === j) return 1
        // pseudo-random symmetric correlation in [-0.6, 0.9]
        const v = (((i * 7 + j * 11 + (ctx.datasetId.length * 13)) % 17) - 8) / 12
        return Math.max(-1, Math.min(1, v))
      }))
      return { widgetType: 'heatmap', data: { classes: names, matrix } }
    }

    case 'distribution': {
      const cols = (PROFILES[ctx.datasetId] ?? []).filter(c => c.dataType === 'numeric').slice(0, 4)
      return {
        widgetType: 'distribution',
        data: cols.map(c => {
          const allRows = ROWS[ctx.datasetId] ?? []
          const values = allRows.slice(0, 200).map(r => Number((r as Record<string, unknown>)[c.name]) || 0)
          return { name: c.name, values }
        })
      }
    }

    case 'feature_importance':
    case 'confusion_matrix':
    case 'roc_curve':
    case 'residuals':
    case 'metric_list':
    case 'metric_card': {
      if (!ctx.experimentId) return null
      const features = ['Glucose', 'BMI', 'Age', 'Pregnancies', 'BloodPressure', 'Insulin', 'DiabetesPedigreeFunction']
      const results = ctx.taskType === 'regression'
        ? generateRegressionResults(ctx.experimentId, features)
        : generateClassificationResults(ctx.experimentId, features)
      switch (def.resolver) {
        case 'feature_importance':
          return { widgetType: 'bar_chart', data: results.visualizations.featureImportance?.map(f => ({ name: f.name, value: f.importance })) }
        case 'confusion_matrix':
          return { widgetType: 'confusion_matrix', data: results.visualizations.confusionMatrix }
        case 'roc_curve':
          return { widgetType: 'roc_curve', data: results.visualizations.rocCurve }
        case 'residuals':
          return { widgetType: 'scatter_chart', data: results.visualizations.residuals }
        case 'metric_list':
          return { widgetType: 'stat_table', data: { columns: ['Metric', 'Value'], rows: Object.entries(results.metrics) } }
        case 'metric_card': {
          const m = results.metrics as Record<string, number>
          const primary = ctx.taskType === 'classification' ? 'f1' : 'r2'
          return { widgetType: 'metric_card', data: { label: ctx.taskType === 'classification' ? 'F1 Score' : 'R²', value: m[primary] } }
        }
      }
      return null
    }
  }
}

// ── Pre-seeded dashboards ──────────────────────────────────────────────

export const SEEDED_DASHBOARDS: Array<{
  id: string
  projectId: string
  name: string
  description: string
  widgets: Array<{ insight: string; experimentId?: string; x: number; y: number; width: number; height: number }>
}> = [
  {
    id: 'dash_diabetes_overview',
    projectId: 'proj_diabetes',
    name: 'Diabetes — Model overview',
    description: 'Top metrics + feature importance for the best Random Forest run.',
    widgets: [
      { insight: 'primary_metric',     experimentId: 'exp_rf_v3', x: 0, y: 0, width: 3, height: 1 },
      { insight: 'feature_importance', experimentId: 'exp_rf_v3', x: 3, y: 0, width: 5, height: 2 },
      { insight: 'metric_list',        experimentId: 'exp_rf_v3', x: 8, y: 0, width: 4, height: 2 },
      { insight: 'confusion_matrix',   experimentId: 'exp_rf_v3', x: 0, y: 1, width: 3, height: 2 },
      { insight: 'missing_values',     x: 0, y: 3, width: 6, height: 1 },
      { insight: 'correlation',        x: 6, y: 3, width: 6, height: 1 }
    ]
  },
  {
    id: 'dash_diabetes_compare',
    projectId: 'proj_diabetes',
    name: 'Diabetes — RF vs LR',
    description: 'Side-by-side metrics for the two best runs.',
    widgets: [
      { insight: 'primary_metric', experimentId: 'exp_rf_v3', x: 0, y: 0, width: 3, height: 1 },
      { insight: 'primary_metric', experimentId: 'exp_lr_v1', x: 3, y: 0, width: 3, height: 1 },
      { insight: 'metric_list',    experimentId: 'exp_rf_v3', x: 6, y: 0, width: 3, height: 1 },
      { insight: 'metric_list',    experimentId: 'exp_lr_v1', x: 9, y: 0, width: 3, height: 1 }
    ]
  }
]