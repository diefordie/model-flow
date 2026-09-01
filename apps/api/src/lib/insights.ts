// Insight key compatibility per PRD §5.11.
// Frontend asks "is `confusion_matrix` valid for this experiment?" — we answer.

import type { TaskType } from "@model-flow/shared";

type ModelKind = "classifier" | "regressor" | "clusterer";

export function modelKind(modelType: string): ModelKind {
  if (/classifier$/i.test(modelType)) return "classifier";
  if (/regressor$/i.test(modelType)) return "regressor";
  return "clusterer";
}

export const INSIGHTS_BY_KIND: Record<ModelKind, string[]> = {
  classifier: [
    "dataset_overview",
    "correlation",
    "feature_importance",
    "confusion_matrix",
    "roc_curve",
    "pr_curve",
    "prediction_distribution",
    "metrics_summary",
  ],
  regressor: [
    "dataset_overview",
    "correlation",
    "feature_importance",
    "actual_vs_predicted",
    "residual_plot",
    "prediction_distribution",
    "metrics_summary",
  ],
  clusterer: [
    "dataset_overview",
    "correlation",
    "cluster_distribution",
    "cluster_scatter",
    "metrics_summary",
  ],
};

export function validInsightsFor(taskType: TaskType, modelType: string): string[] {
  const kind = modelKind(modelType);
  // Clusterer tasks map to clustering regardless of model id naming.
  if (taskType === "clustering") {
    return INSIGHTS_BY_KIND.clusterer;
  }
  return INSIGHTS_BY_KIND[kind] ?? [];
}