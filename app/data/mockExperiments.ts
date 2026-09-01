/**
 * Mock experiment result fixtures for Sprint 4.
 *
 * Realistic-looking metrics + visualizations to populate the experiment
 * detail page. Two pre-seeded experiments (one classification, one
 * regression) plus helpers to synthesize results for a fresh
 * experiment submission.
 */

import type {
  ClassificationMetrics,
  ConfusionMatrixData,
  ExperimentResults,
  FeatureImportance,
  RegressionMetrics,
  ResidualsData,
  RocCurveData
} from '~/types/api'

/** Seeded PRNG for deterministic fixture generation. */
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

function generateConfusionMatrix(rng: () => number, n: number): ConfusionMatrixData {
  const classes = n === 2 ? ['No', 'Yes'] : Array.from({ length: n }, (_, i) => `Class ${i}`)
  // realistic imbalance: diagonal dominant
  const matrix: number[][] = []
  for (let r = 0; r < n; r++) {
    const row: number[] = []
    let remaining = Math.floor(rng() * 60 + 80)
    for (let c = 0; c < n; c++) {
      if (r === c) row.push(remaining)
      else {
        const off = Math.floor(rng() * 15)
        row.push(off)
        remaining -= off
      }
    }
    matrix.push(row)
  }
  return { classes, matrix }
}

function generateRocCurve(rng: () => number): RocCurveData {
  const points = 30
  const fpr = [0]
  const tpr = [0]
  for (let i = 1; i < points; i++) {
    const x = i / points
    fpr.push(x)
    // y = 1 - exp(-k*x) shaped like a real ROC
    const y = Math.min(1, 1 - Math.exp(-3.5 * x) + (rng() - 0.5) * 0.03)
    tpr.push(Math.max(0, Math.min(1, y)))
  }
  fpr.push(1); tpr.push(1)
  return { fpr: [fpr], tpr: [tpr], auc: 0.87 + rng() * 0.08 }
}

function generateResiduals(rng: () => number, n = 60): ResidualsData {
  const predicted: number[] = []
  const residuals: number[] = []
  for (let i = 0; i < n; i++) {
    predicted.push(rng() * 250 + 50)
    residuals.push((rng() - 0.5) * 30 + Math.sin(i / 8) * 4)
  }
  return { predicted, residuals }
}

function generateFeatureImportance(rng: () => number, names: string[]): Array<{ name: string; importance: number }> {
  const raw = names.map(() => rng() * 0.9 + 0.1)
  const sum = raw.reduce((a, b) => a + b, 0)
  return names
    .map((name, i) => ({ name, importance: raw[i] / sum }))
    .sort((a, b) => b.importance - a.importance)
}

export function generateClassificationResults(experimentId: string, features: string[]): ExperimentResults {
  const rng = seeded(experimentId.split('').reduce((s, c) => s + c.charCodeAt(0), 0))
  const classes: number = 2
  const metrics: ClassificationMetrics = {
    accuracy:  0.78 + rng() * 0.08,
    precision: 0.74 + rng() * 0.10,
    recall:    0.72 + rng() * 0.10,
    f1:        0.74 + rng() * 0.08,
    rocAuc:    0.84 + rng() * 0.08
  }
  return {
    metrics,
    visualizations: {
      confusionMatrix: generateConfusionMatrix(rng, classes),
      rocCurve: generateRocCurve(rng),
      featureImportance: generateFeatureImportance(rng, features)
    },
    model: {
      id: experimentId + '_model',
      framework: 'scikit-learn 1.5.x',
      serialized: { sizeBytes: 24_000 + Math.floor(rng() * 60_000), checksum: 'sha256:...' + Math.floor(rng() * 1e9).toString(16) },
      downloadUrl: `/api/v1/experiments/${experimentId}/artifact`
    }
  }
}

export function generateRegressionResults(experimentId: string, features: string[]): ExperimentResults {
  const rng = seeded(experimentId.split('').reduce((s, c) => s + c.charCodeAt(0), 0))
  const metrics: RegressionMetrics = {
    mae:  8_000 + rng() * 4_000,
    mse:  140_000_000 + rng() * 60_000_000,
    rmse: 11_800 + rng() * 2_500,
    r2:   0.82 + rng() * 0.10
  }
  return {
    metrics,
    visualizations: {
      residuals: generateResiduals(rng),
      featureImportance: generateFeatureImportance(rng, features)
    },
    model: {
      id: experimentId + '_model',
      framework: 'scikit-learn 1.5.x',
      serialized: { sizeBytes: 18_000 + Math.floor(rng() * 40_000), checksum: 'sha256:...' + Math.floor(rng() * 1e9).toString(16) },
      downloadUrl: `/api/v1/experiments/${experimentId}/artifact`
    }
  }
}

/** Pre-seeded "completed" experiments (so the list view has something). */
export const SEEDED_EXPERIMENTS: Array<{
  id: string
  projectId: string
  name: string
  taskType: 'classification' | 'regression'
  modelId: string
  features: string[]
  createdAtOffset: string  // relative offset for "X ago" display
}> = [
  {
    id: 'exp_baseline',
    projectId: 'proj_diabetes',
    name: 'Random Forest (baseline)',
    taskType: 'classification',
    modelId: 'random_forest_classifier',
    features: ['Glucose', 'BMI', 'Age', 'Pregnancies', 'BloodPressure'],
    createdAtOffset: '2h'
  },
  {
    id: 'exp_logreg',
    projectId: 'proj_diabetes',
    name: 'Logistic Regression',
    taskType: 'classification',
    modelId: 'logistic_regression',
    features: ['Glucose', 'BMI', 'Age'],
    createdAtOffset: '1d'
  },
  {
    id: 'exp_rf_housing',
    projectId: 'proj_housing',
    name: 'Random Forest Regressor',
    taskType: 'regression',
    modelId: 'random_forest_regressor',
    features: ['OverallQual', 'GrLivArea', 'GarageCars', 'TotalBsmtSF', 'YearBuilt'],
    createdAtOffset: '3h'
  }
]