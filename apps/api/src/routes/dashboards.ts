// /api/v1/projects/:projectId/dashboards + /api/v1/dashboards/:id.

import { Hono } from "hono";
import { z } from "zod";
import { errorResponse } from "../errors.ts";
import { requestClient, type AuthContext } from "../auth.ts";
import { validateBody } from "../lib/validate.ts";
import { validInsightsFor } from "../lib/insights.ts";
import type { DashboardLayout } from "@model-flow/shared";

const router = new Hono<AuthContext>();
const projectScoped = new Hono<AuthContext>();

const createSchema = z.object({
  experimentId: z.number().int().positive(),
  insights: z.array(z.string().min(1)).min(1),
});

const updateSchema = z.object({
  layout: z
    .object({
      widgets: z.array(
        z.object({
          key: z.string(),
          x: z.number().int(),
          y: z.number().int(),
          w: z.number().int().min(1).max(12),
          h: z.number().int().min(1),
        })
      ),
    })
    .optional(),
  insights: z.array(z.string().min(1)).min(1).optional(),
});

// 12-col grid default layout. One row per widget; w=6 (half), w=12 (full).
function defaultLayout(insights: string[]): DashboardLayout {
  return {
    widgets: insights.map((key, i) => ({ key, x: 0, y: i, w: 6, h: 4 })),
  };
}

// List dashboards belonging to a project (PRD §4.5).
projectScoped.get("/", async (c) => {
  const sb = requestClient(c);
  const projectId = Number(c.req.param("projectId"));
  if (!Number.isInteger(projectId)) return errorResponse(c, "VALIDATION_ERROR", "Bad id");
  const { data, error } = await sb
    .from("dashboards")
    .select("id,project_id,experiment_id,name,layout,insights,created_at,updated_at")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });
  if (error) return errorResponse(c, "INTERNAL_ERROR", error.message);
  return c.json(data ?? []);
});

projectScoped.post("/", validateBody(createSchema), async (c) => {
  const sb = requestClient(c);
  const user = c.get("user");
  const projectId = Number(c.req.param("projectId"));
  if (!Number.isInteger(projectId)) return errorResponse(c, "VALIDATION_ERROR", "Bad id");
  const body = c.get("validated" as never) as z.infer<typeof createSchema>;

  // Look up the experiment to filter insights.
  const { data: exp, error: expErr } = await sb
    .from("experiments")
    .select("id,project_id,task_type,model_configs:model_configs(model_type)")
    .eq("id", body.experimentId)
    .maybeSingle();
  if (expErr) return errorResponse(c, "INTERNAL_ERROR", expErr.message);
  if (!exp) return errorResponse(c, "NOT_FOUND", "Experiment not found");
  if (exp.project_id !== projectId) {
    return errorResponse(c, "INVALID_CONFIGURATION", "Experiment does not belong to this project");
  }

  const modelType = (exp as unknown as { model_configs?: { model_type: string }[] })
    .model_configs?.[0]?.model_type;
  if (!modelType) return errorResponse(c, "INVALID_CONFIGURATION", "Experiment has no model_config");

  const valid = new Set(validInsightsFor(exp.task_type, modelType));
  const filtered = body.insights.filter((k) => valid.has(k));
  if (filtered.length === 0) {
    return errorResponse(c, "INVALID_CONFIGURATION", "No valid insights for this experiment");
  }

  const { data, error } = await sb
    .from("dashboards")
    .insert({
      project_id: projectId,
      experiment_id: body.experimentId,
      owner_id: user.id,
      name: `Dashboard ${new Date().toISOString().slice(0, 19)}`,
      layout: defaultLayout(filtered),
      insights: filtered,
    })
    .select("*")
    .single();
  if (error) return errorResponse(c, "INTERNAL_ERROR", error.message);
  return c.json(data, 201);
});

export { projectScoped as dashboardCreate };

router.get("/:dashboardId", async (c) => {
  const sb = requestClient(c);
  const id = Number(c.req.param("dashboardId"));
  if (!Number.isInteger(id)) return errorResponse(c, "VALIDATION_ERROR", "Bad id");
  const { data, error } = await sb.from("dashboards").select("*").eq("id", id).maybeSingle();
  if (error) return errorResponse(c, "INTERNAL_ERROR", error.message);
  if (!data) return errorResponse(c, "NOT_FOUND");
  return c.json(data);
});

// Delete a dashboard (PRD §4.5).
router.delete("/:dashboardId", async (c) => {
  const sb = requestClient(c);
  const id = Number(c.req.param("dashboardId"));
  if (!Number.isInteger(id)) return errorResponse(c, "VALIDATION_ERROR", "Bad id");
  const { data, error } = await sb.from("dashboards").delete().eq("id", id).select("id").maybeSingle();
  if (error) return errorResponse(c, "INTERNAL_ERROR", error.message);
  if (!data) return errorResponse(c, "NOT_FOUND");
  return c.json({ success: true });
});

router.patch("/:dashboardId", validateBody(updateSchema), async (c) => {
  const sb = requestClient(c);
  const id = Number(c.req.param("dashboardId"));
  if (!Number.isInteger(id)) return errorResponse(c, "VALIDATION_ERROR", "Bad id");
  const body = c.get("validated" as never) as z.infer<typeof updateSchema>;
  const patch: Record<string, unknown> = {};
  if (body.layout) patch.layout = body.layout;
  if (body.insights) patch.insights = body.insights;
  const { data, error } = await sb
    .from("dashboards")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) return errorResponse(c, "INTERNAL_ERROR", error.message);
  if (!data) return errorResponse(c, "NOT_FOUND");
  return c.json(data);
});

export default router;