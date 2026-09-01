// /api/v1/projects/:projectId/insights?task=...
//
// Lists the insight catalog compatible with the given task. The catalog is
// the same source the dashboard composer uses (lib/insights.ts), so a widget
// added to the catalog here automatically appears in the selector.
//
// Response shape mirrors what the frontend expects from `InsightDescriptor`.

import { Hono } from "hono";
import { errorResponse } from "../errors.ts";
import { type AuthContext } from "../auth.ts";
import { INSIGHTS_BY_KIND } from "../lib/insights.ts";
import type { TaskType } from "@model-flow/shared";

const router = new Hono<AuthContext>();

interface InsightDescriptor {
  key: string;
  label: string;
  category: "dataset" | "eda" | "ml" | "model_metrics";
  available: boolean;
}

const LABELS: Record<string, string> = {
  dataset_overview: "Dataset overview",
  correlation: "Correlation matrix",
  feature_importance: "Feature importance",
  confusion_matrix: "Confusion matrix",
  roc_curve: "ROC curve",
  pr_curve: "Precision-recall curve",
  prediction_distribution: "Prediction distribution",
  metrics_summary: "Metrics summary",
  actual_vs_predicted: "Actual vs predicted",
  residual_plot: "Residual plot",
  cluster_distribution: "Cluster distribution",
  cluster_scatter: "Cluster scatter",
  missing_values: "Missing values",
  distribution: "Feature distribution",
  metric_list: "All metrics",
  primary_metric: "Primary metric",
};

const CATEGORY: Record<string, InsightDescriptor["category"]> = {
  dataset_overview: "dataset",
  missing_values: "dataset",
  correlation: "eda",
  distribution: "eda",
  feature_importance: "ml",
  confusion_matrix: "ml",
  roc_curve: "ml",
  pr_curve: "ml",
  prediction_distribution: "ml",
  actual_vs_predicted: "ml",
  residual_plot: "ml",
  cluster_distribution: "ml",
  cluster_scatter: "ml",
  metrics_summary: "model_metrics",
  metric_list: "model_metrics",
  primary_metric: "model_metrics",
};

router.get("/", (c) => {
  const task = c.req.query("task") as TaskType | undefined;
  if (!task || (task !== "classification" && task !== "regression" && task !== "clustering")) {
    return errorResponse(
      c,
      "VALIDATION_ERROR",
      "Query param `task` must be classification|regression|clustering"
    );
  }
  const kind = task === "clustering" ? "clusterer" : task === "classification" ? "classifier" : "regressor";
  const insights: InsightDescriptor[] = INSIGHTS_BY_KIND[kind].map((key) => ({
    key,
    label: LABELS[key] ?? key.replace(/_/g, " "),
    category: CATEGORY[key] ?? "ml",
    available: true,
  }));
  return c.json({ insights });
});

export default router;