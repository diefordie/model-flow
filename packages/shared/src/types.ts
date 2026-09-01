// Shared API/Worker contract types.
// Both apps/api (Hono) and apps/worker (Python) reference these shapes
// verbatim — keep in sync with supabase/migrations/0001_init.sql.

export type TaskType = "classification" | "regression" | "clustering";

export type ProjectStatus = "draft" | "active" | "completed" | "archived";

export type ExperimentStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type OptimizationMethod = "manual" | "grid_search" | "random_search";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_DATASET"
  | "UNSUPPORTED_FILE"
  | "FILE_TOO_LARGE"
  | "INVALID_CONFIGURATION"
  | "TRAINING_FAILED"
  | "MODEL_ERROR"
  | "DATA_PROCESSING_ERROR"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INTERNAL_ERROR";

export interface ErrorEnvelope {
  success: false;
  error: { code: ErrorCode; message: string };
}

// --- Projects ---
export interface CreateProjectInput {
  name: string;
  description?: string;
}
export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
}
export interface Project {
  id: number;
  owner_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

// --- Datasets ---
export interface Dataset {
  id: number;
  project_id: number;
  name: string;
  file_path: string;
  file_type: "csv" | "xlsx";
  file_size: number;
  row_count: number | null;
  column_count: number | null;
  schema: Record<string, unknown> | null;
  created_at: string;
}
export interface DatasetColumn {
  id: number;
  dataset_id: number;
  name: string;
  data_type: "number" | "binary" | "categorical" | "text" | "datetime";
  nullable: boolean;
  unique_count: number | null;
  missing_count: number | null;
  statistics: Record<string, unknown> | null;
}

// --- Models registry ---
export interface ParameterDef {
  name: string;
  type: "integer" | "number" | "enum" | "boolean";
  default?: number | string | boolean;
  min?: number;
  max?: number;
  options?: (string | number)[];
  description?: string;
}
export interface ModelEntry {
  id: string;
  name: string;
  parameters: ParameterDef[];
}
export interface ModelRegistryResponse {
  task: TaskType;
  models: ModelEntry[];
}

// --- Experiments ---
export interface PreprocessingConfig {
  missingValues?: "drop" | "mean" | "median" | "most_frequent" | "constant";
  scaling?: "none" | "standard" | "minmax" | "robust";
  encoding?: "onehot" | "ordinal";
}
export interface TrainingConfig {
  testSize?: number;
  randomState?: number;
}
export interface ModelConfigInput {
  type: string;
  parameters?: Record<string, number | string | boolean>;
}
export interface CreateExperimentInput {
  datasetId: number;
  taskType: TaskType;
  target?: string;
  features: string[];
  preprocessing?: PreprocessingConfig;
  model: ModelConfigInput;
  optimization?:
    | { method: "manual" }
    | { method: "grid_search"; searchSpace: Record<string, unknown>; cvFolds?: number; scoring?: string }
    | { method: "random_search"; iterations: number; searchSpace: Record<string, unknown>; cvFolds?: number; scoring?: string };
  training?: TrainingConfig;
}
export interface ExperimentStatusResponse {
  status: ExperimentStatus;
  stage?: string;
  progress?: number;
}
export interface ExperimentResultsResponse {
  metrics: Record<string, number>;
  visualizations: Record<string, unknown>;
  featureImportance: Record<string, number> | null;
  model: { artifactPath: string; bytes: number; metadata: Record<string, unknown> };
}

// --- Dashboards ---
export interface CreateDashboardInput {
  experimentId: number;
  insights: string[];
}
export interface DashboardLayout {
  widgets: { key: string; x: number; y: number; w: number; h: number }[];
}

// --- Predictions ---
export interface PredictInput {
  features: Record<string, number | string>;
}
export interface ClassificationPrediction {
  prediction: number | string;
  probability: number | null;
}
export interface RegressionPrediction {
  prediction: number;
}
export type PredictResponse = ClassificationPrediction | RegressionPrediction;