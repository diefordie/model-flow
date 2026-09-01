// /api/v1/experiments and /api/v1/projects/:projectId/experiments.
//
// PRD §4.4 contracts:
//   POST creates row + preprocessing_config + model_config + queued job.
//   Response < 2s, returns { experimentId, status }.
//   GET status reads current_stage + progress (worker writes them).

import { Hono } from "hono";
import { z } from "zod";
import { errorResponse } from "../errors.ts";
import { requestClient, supabaseAdmin, type AuthContext } from "../auth.ts";
import { validateBody } from "../lib/validate.ts";
import { enqueueJob } from "../lib/queue.ts";
import { getModelsForTask } from "../lib/modelRegistry.ts";

const router = new Hono<AuthContext>();

const preprocessingSchema = z.object({
  missingValues: z.enum(["drop", "mean", "median", "most_frequent", "constant"]).default("median"),
  scaling: z.enum(["none", "standard", "minmax", "robust"]).default("standard"),
  encoding: z.enum(["onehot", "ordinal"]).default("onehot"),
});

const optimizationSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("manual") }),
  z.object({
    method: z.literal("grid_search"),
    searchSpace: z.record(z.unknown()),
    cvFolds: z.number().int().min(2).max(10).default(5),
    scoring: z.string().default("f1"),
  }),
  z.object({
    method: z.literal("random_search"),
    iterations: z.number().int().min(1).max(200).default(20),
    searchSpace: z.record(z.unknown()),
    cvFolds: z.number().int().min(2).max(10).default(5),
    scoring: z.string().default("f1"),
  }),
]);

const createSchema = z.object({
  datasetId: z.number().int().positive(),
  taskType: z.enum(["classification", "regression", "clustering"]),
  target: z.string().min(1).optional(),
  features: z.array(z.string().min(1)).min(1).max(200),
  preprocessing: preprocessingSchema.optional(),
  model: z.object({
    type: z.string().min(1),
    parameters: z.record(z.union([z.number(), z.string(), z.boolean()])).optional(),
  }),
  optimization: optimizationSchema.optional(),
  training: z
    .object({
      testSize: z.number().min(0.05).max(0.5).default(0.2),
      randomState: z.number().int().default(42),
    })
    .optional(),
});

// Validate that target/features exist in the dataset and that the requested
// model id is registered for the task. Cheap because we already have
// getModelsForTask and dataset_columns.
async function validateExperimentConfig(
  sb: ReturnType<typeof requestClient>,
  input: z.infer<typeof createSchema>
) {
  const { data: cols, error } = await sb
    .from("dataset_columns")
    .select("name")
    .eq("dataset_id", input.datasetId);
  if (error) return `Could not read dataset columns: ${error.message}`;
  const available = new Set((cols ?? []).map((c: { name: string }) => c.name));

  for (const f of input.features) {
    if (!available.has(f)) return `Feature '${f}' not found in dataset`;
  }
  if (input.target && !available.has(input.target)) {
    return `Target '${input.target}' not found in dataset`;
  }
  if (input.target && input.features.includes(input.target)) {
    return `Target cannot also be a feature`;
  }
  const dupes = input.features.filter((f, i, arr) => arr.indexOf(f) !== i);
  if (dupes.length) return `Duplicate features: ${[...new Set(dupes)].join(", ")}`;

  if (input.taskType !== "clustering" && !input.target) {
    return `Target column required for ${input.taskType}`;
  }

  const registry = getModelsForTask(input.taskType);
  if (!registry.some((m) => m.id === input.model.type)) {
    return `Model '${input.model.type}' not registered for task ${input.taskType}`;
  }
  return null;
}

router.post("/", validateBody(createSchema), async (c) => {
  const sb = requestClient(c);
  const user = c.get("user");
  const input = c.get("validated" as never) as z.infer<typeof createSchema>;

  // Ownership of dataset (also enforces RLS later).
  const { data: ds } = await sb.from("datasets").select("id,project_id").eq("id", input.datasetId).maybeSingle();
  if (!ds) return errorResponse(c, "NOT_FOUND", "Dataset not found");

  const err = await validateExperimentConfig(sb, input);
  if (err) return errorResponse(c, "INVALID_CONFIGURATION", err);

  // Create experiment row.
  const { data: exp, error: expErr } = await sb
    .from("experiments")
    .insert({
      project_id: ds.project_id,
      dataset_id: input.datasetId,
      owner_id: user.id,
      name: `Run ${new Date().toISOString().slice(0, 19)}`,
      task_type: input.taskType,
      target_column: input.target ?? null,
      feature_columns: input.features,
      status: "queued",
      current_stage: "queued",
      progress: 0,
    })
    .select("id")
    .single();
  if (expErr || !exp) return errorResponse(c, "INTERNAL_ERROR", expErr?.message);

  const opt = input.optimization ?? { method: "manual" as const };
  const { error: cfgErr } = await sb.from("model_configs").insert({
    experiment_id: exp.id,
    model_type: input.model.type,
    hyperparameters: input.model.parameters ?? {},
    optimization_method: opt.method,
    cv_folds: "cvFolds" in opt ? opt.cvFolds : null,
    scoring: "scoring" in opt ? opt.scoring : null,
  });
  if (cfgErr) return errorResponse(c, "INTERNAL_ERROR", cfgErr.message);

  const { error: ppErr } = await sb
    .from("preprocessing_configs")
    .insert({
      experiment_id: exp.id,
      config: {
        ...(input.preprocessing ?? {}),
        testSize: input.training?.testSize ?? 0.2,
        randomState: input.training?.randomState ?? 42,
      },
    });
  if (ppErr) return errorResponse(c, "INTERNAL_ERROR", ppErr.message);

  await enqueueJob(supabaseAdmin, {
    type: "training",
    experiment_id: exp.id,
    payload: { hyperparameters: input.model.parameters ?? {} },
  });

  return c.json({ experimentId: exp.id, status: "queued" }, 201);
});

router.get("/:experimentId/status", async (c) => {
  const sb = requestClient(c);
  const id = Number(c.req.param("experimentId"));
  if (!Number.isInteger(id)) return errorResponse(c, "VALIDATION_ERROR", "Bad id");
  const { data, error } = await sb
    .from("experiments")
    .select("status,current_stage,progress")
    .eq("id", id)
    .maybeSingle();
  if (error) return errorResponse(c, "INTERNAL_ERROR", error.message);
  if (!data) return errorResponse(c, "NOT_FOUND");
  return c.json({
    status: data.status,
    stage: data.current_stage ?? undefined,
    progress: data.progress ?? undefined,
  });
});

router.get("/:experimentId/results", async (c) => {
  const sb = requestClient(c);
  const id = Number(c.req.param("experimentId"));
  if (!Number.isInteger(id)) return errorResponse(c, "VALIDATION_ERROR", "Bad id");

  const [metricsR, resultsR, artifactR] = await Promise.all([
    sb.from("experiment_metrics").select("metric_name,metric_value").eq("experiment_id", id),
    sb.from("experiment_results").select("result_type,result_data").eq("experiment_id", id),
    sb.from("model_artifacts").select("storage_path,bytes,metadata").eq("experiment_id", id).maybeSingle(),
  ]);
  if (metricsR.error || resultsR.error || artifactR.error) {
    return errorResponse(c, "INTERNAL_ERROR", metricsR.error?.message ?? resultsR.error?.message);
  }
  if (!artifactR.data) return errorResponse(c, "MODEL_ERROR", "Model artifact missing");

  const metrics = Object.fromEntries(
    (metricsR.data ?? []).map((m: { metric_name: string; metric_value: number }) => [m.metric_name, m.metric_value])
  );
  const visualizations: Record<string, unknown> = {};
  let featureImportance: Record<string, number> | null = null;
  for (const r of resultsR.data ?? []) {
    if (r.result_type === "feature_importance") {
      featureImportance = r.result_data as Record<string, number>;
    } else {
      visualizations[r.result_type] = r.result_data;
    }
  }

  return c.json({
    metrics,
    visualizations,
    featureImportance,
    model: {
      artifactPath: artifactR.data.storage_path,
      bytes: artifactR.data.bytes,
      metadata: artifactR.data.metadata,
    },
  });
});

router.post("/:experimentId/cancel", async (c) => {
  const sb = requestClient(c);
  const id = Number(c.req.param("experimentId"));
  if (!Number.isInteger(id)) return errorResponse(c, "VALIDATION_ERROR", "Bad id");
  const { error } = await sb
    .from("experiments")
    .update({ status: "cancelled" })
    .eq("id", id)
    .in("status", ["queued", "running"]);
  if (error) return errorResponse(c, "INTERNAL_ERROR", error.message);
  return c.json({ success: true });
});

export default router;