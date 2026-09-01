// GET /api/v1/models?task=... — returns available models + parameter schema.

import { Hono } from "hono";
import { z } from "zod";
import { errorResponse } from "../errors.ts";
import { getModelsForTask } from "../lib/modelRegistry.ts";
import type { TaskType } from "@model-flow/shared";

const querySchema = z.object({
  task: z.enum(["classification", "regression", "clustering"]),
});

const router = new Hono();

router.get("/", (c) => {
  const parsed = querySchema.safeParse({ task: c.req.query("task") });
  if (!parsed.success) {
    return errorResponse(
      c,
      "VALIDATION_ERROR",
      "Query param `task` must be classification|regression|clustering"
    );
  }
  return c.json({ task: parsed.data.task, models: getModelsForTask(parsed.data.task as TaskType) });
});

export default router;