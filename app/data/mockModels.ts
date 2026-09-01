/**
 * Mock model registry + parameter schemas.
 *
 * Mirrors `05-ml-worker-pipeline.md` §3 (Classification / Regression /
 * Clustering MVP list) and `04-api-reference.md` §3 (parameter schema
 * format). The HyperparameterForm consumes this and renders inputs
 * dynamically — never hard-coded per model.
 *
 * Adding a model here should require zero frontend changes to the
 * HyperparameterForm; the form just iterates `parameters` and renders
 * one input per item based on `type`.
 */

import type { TaskType } from '~/types/api'

export type ParamType = 'integer' | 'float' | 'enum' | 'boolean'

export interface ModelParam {
  name: string
  type: ParamType
  default?: number | string | boolean
  min?: number
  max?: number
  options?: Array<string | number>
  description?: string
}

export interface ModelEntry {
  id: string
  name: string
  description: string
  parameters: ModelParam[]
}

export const MODEL_REGISTRY: Record<TaskType, ModelEntry[]> = {
  classification: [
    {
      id: 'logistic_regression',
      name: 'Logistic Regression',
      description: 'Linear baseline. Fast, interpretable, good for linearly separable data.',
      parameters: [
        { name: 'C',             type: 'float',   default: 1.0,  min: 0.001, max: 100,   description: 'Inverse regularization strength' },
        { name: 'max_iter',      type: 'integer', default: 100,  min: 50,   max: 1000,  description: 'Maximum training iterations' },
        { name: 'solver',        type: 'enum',    options: ['lbfgs', 'liblinear', 'saga'], default: 'lbfgs' },
        { name: 'random_state',  type: 'integer', default: 42 }
      ]
    },
    {
      id: 'decision_tree_classifier',
      name: 'Decision Tree',
      description: 'Non-linear, easy to visualize, prone to overfitting on small data.',
      parameters: [
        { name: 'max_depth',         type: 'integer', default: 10,   min: 1,  max: 100 },
        { name: 'min_samples_split', type: 'integer', default: 2,    min: 2,  max: 50 },
        { name: 'min_samples_leaf',  type: 'integer', default: 1,    min: 1,  max: 50 },
        { name: 'criterion',         type: 'enum',    options: ['gini', 'entropy', 'log_loss'], default: 'gini' },
        { name: 'random_state',      type: 'integer', default: 42 }
      ]
    },
    {
      id: 'random_forest_classifier',
      name: 'Random Forest',
      description: 'Ensemble of decision trees. Strong baseline for tabular data.',
      parameters: [
        { name: 'n_estimators',      type: 'integer', default: 100, min: 10, max: 1000, description: 'Number of trees' },
        { name: 'max_depth',         type: 'integer', default: 10,  min: 1,  max: 100 },
        { name: 'min_samples_split', type: 'integer', default: 2,   min: 2,  max: 50 },
        { name: 'min_samples_leaf',  type: 'integer', default: 1,   min: 1,  max: 50 },
        { name: 'criterion',         type: 'enum',    options: ['gini', 'entropy', 'log_loss'], default: 'gini' },
        { name: 'random_state',      type: 'integer', default: 42 }
      ]
    },
    {
      id: 'knn_classifier',
      name: 'K-Nearest Neighbors',
      description: 'Instance-based. No training phase; slow at prediction time.',
      parameters: [
        { name: 'n_neighbors', type: 'integer', default: 5, min: 1, max: 50 },
        { name: 'weights',     type: 'enum',    options: ['uniform', 'distance'], default: 'uniform' },
        { name: 'metric',      type: 'enum',    options: ['euclidean', 'manhattan', 'minkowski'], default: 'euclidean' }
      ]
    },
    {
      id: 'svc',
      name: 'Support Vector Machine',
      description: 'Effective in high-dimensional spaces; slower on large datasets.',
      parameters: [
        { name: 'C',            type: 'float',   default: 1.0, min: 0.01, max: 100, description: 'Regularization parameter' },
        { name: 'kernel',       type: 'enum',    options: ['linear', 'rbf', 'poly', 'sigmoid'], default: 'rbf' },
        { name: 'gamma',        type: 'enum',    options: ['scale', 'auto'], default: 'scale' },
        { name: 'random_state', type: 'integer', default: 42 }
      ]
    }
  ],
  regression: [
    {
      id: 'linear_regression',
      name: 'Linear Regression',
      description: 'Baseline model. Assumes a linear relationship between features and target.',
      parameters: [
        { name: 'fit_intercept', type: 'boolean', default: true }
      ]
    },
    {
      id: 'decision_tree_regressor',
      name: 'Decision Tree Regressor',
      description: 'Non-linear regression. Risk of overfitting without depth limit.',
      parameters: [
        { name: 'max_depth',         type: 'integer', default: 10, min: 1, max: 100 },
        { name: 'min_samples_split', type: 'integer', default: 2,  min: 2, max: 50 },
        { name: 'min_samples_leaf',  type: 'integer', default: 1,  min: 1, max: 50 },
        { name: 'criterion',         type: 'enum',    options: ['squared_error', 'absolute_error', 'friedman_mse'], default: 'squared_error' },
        { name: 'random_state',      type: 'integer', default: 42 }
      ]
    },
    {
      id: 'random_forest_regressor',
      name: 'Random Forest Regressor',
      description: 'Ensemble regressor. Robust to outliers, captures non-linear patterns.',
      parameters: [
        { name: 'n_estimators',      type: 'integer', default: 100, min: 10, max: 1000 },
        { name: 'max_depth',         type: 'integer', default: 10,  min: 1,  max: 100 },
        { name: 'min_samples_split', type: 'integer', default: 2,   min: 2,  max: 50 },
        { name: 'min_samples_leaf',  type: 'integer', default: 1,   min: 1,  max: 50 },
        { name: 'random_state',      type: 'integer', default: 42 }
      ]
    }
  ],
  clustering: [
    {
      id: 'kmeans',
      name: 'K-Means',
      description: 'Partitions data into k clusters by centroid distance.',
      parameters: [
        { name: 'n_clusters',   type: 'integer', default: 8, min: 2, max: 50 },
        { name: 'init',         type: 'enum',    options: ['k-means++', 'random'], default: 'k-means++' },
        { name: 'n_init',       type: 'integer', default: 10, min: 1, max: 50 },
        { name: 'max_iter',     type: 'integer', default: 300, min: 50, max: 1000 },
        { name: 'random_state', type: 'integer', default: 42 }
      ]
    },
    {
      id: 'dbscan',
      name: 'DBSCAN',
      description: 'Density-based. Detects arbitrary cluster shapes; identifies outliers.',
      parameters: [
        { name: 'eps',    type: 'float',   default: 0.5, min: 0.01, max: 10,  description: 'Max distance between two samples' },
        { name: 'min_samples', type: 'integer', default: 5, min: 2, max: 50, description: 'Min samples in a neighborhood' },
        { name: 'metric', type: 'enum', options: ['euclidean', 'manhattan', 'chebyshev'], default: 'euclidean' }
      ]
    }
  ]
}

/** Returns the metric options allowed for a task type (PRD §5.5). */
export function metricsForTask(task: TaskType): Array<{ value: string; label: string }> {
  if (task === 'classification') {
    return [
      { value: 'accuracy',  label: 'Accuracy' },
      { value: 'precision', label: 'Precision' },
      { value: 'recall',    label: 'Recall' },
      { value: 'f1',        label: 'F1 Score' },
      { value: 'roc_auc',   label: 'ROC-AUC' }
    ]
  }
  if (task === 'regression') {
    return [
      { value: 'mae',  label: 'MAE'  },
      { value: 'mse',  label: 'MSE'  },
      { value: 'rmse', label: 'RMSE' },
      { value: 'r2',   label: 'R²'   }
    ]
  }
  return []
}