// Static model registry. Mirrors PRD §5.3 — frontend renders hyperparameter
// forms from this metadata; it MUST NOT hard-code model params (per PRD §4.3).
//
// IDs are the canonical contract between this registry and the Python worker
// (apps/worker/src/registry.py). Adding a new model here without adding it
// there is a bug; the registry sync test catches it.

import type { ModelEntry, TaskType } from "@model-flow/shared";

export const MODEL_REGISTRY: Record<TaskType, ModelEntry[]> = {
  classification: [
    {
      id: "logistic_regression",
      name: "Logistic Regression",
      parameters: [
        { name: "C", type: "number", default: 1.0, min: 0.001, max: 100 },
        { name: "max_iter", type: "integer", default: 100, min: 50, max: 5000 },
      ],
    },
    {
      id: "decision_tree_classifier",
      name: "Decision Tree",
      parameters: [
        { name: "max_depth", type: "integer", default: 10, min: 1, max: 100 },
        { name: "min_samples_split", type: "integer", default: 2, min: 2, max: 50 },
        { name: "criterion", type: "enum", options: ["gini", "entropy"], default: "gini" },
      ],
    },
    {
      id: "random_forest_classifier",
      name: "Random Forest",
      parameters: [
        { name: "n_estimators", type: "integer", default: 100, min: 10, max: 1000 },
        { name: "max_depth", type: "integer", default: 10, min: 1, max: 100 },
        { name: "min_samples_split", type: "integer", default: 2 },
        { name: "min_samples_leaf", type: "integer", default: 1 },
        { name: "criterion", type: "enum", options: ["gini", "entropy"], default: "gini" },
        { name: "random_state", type: "integer", default: 42 },
      ],
    },
    {
      id: "knn_classifier",
      name: "K-Nearest Neighbors",
      parameters: [
        { name: "n_neighbors", type: "integer", default: 5, min: 1, max: 50 },
        { name: "weights", type: "enum", options: ["uniform", "distance"], default: "uniform" },
      ],
    },
    {
      id: "svm_classifier",
      name: "Support Vector Machine",
      parameters: [
        { name: "C", type: "number", default: 1.0, min: 0.001, max: 100 },
        { name: "kernel", type: "enum", options: ["linear", "rbf", "poly"], default: "rbf" },
      ],
    },
  ],
  regression: [
    {
      id: "linear_regression",
      name: "Linear Regression",
      parameters: [],
    },
    {
      id: "decision_tree_regressor",
      name: "Decision Tree Regressor",
      parameters: [
        { name: "max_depth", type: "integer", default: 10, min: 1, max: 100 },
        { name: "min_samples_split", type: "integer", default: 2 },
      ],
    },
    {
      id: "random_forest_regressor",
      name: "Random Forest Regressor",
      parameters: [
        { name: "n_estimators", type: "integer", default: 100, min: 10, max: 1000 },
        { name: "max_depth", type: "integer", default: 10, min: 1, max: 100 },
        { name: "random_state", type: "integer", default: 42 },
      ],
    },
  ],
  clustering: [
    {
      id: "kmeans",
      name: "K-Means",
      parameters: [
        { name: "n_clusters", type: "integer", default: 3, min: 2, max: 20 },
        { name: "random_state", type: "integer", default: 42 },
      ],
    },
    {
      id: "dbscan",
      name: "DBSCAN",
      parameters: [
        { name: "eps", type: "number", default: 0.5, min: 0.01, max: 10 },
        { name: "min_samples", type: "integer", default: 5, min: 1, max: 50 },
      ],
    },
  ],
};

export function getModelsForTask(task: TaskType): ModelEntry[] {
  return MODEL_REGISTRY[task] ?? [];
}