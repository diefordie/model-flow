// /api/v1/projects/:projectId/experiments — list experiments for a project.

import { Hono } from "hono";
import { errorResponse } from "../errors.ts";
import { requestClient, type AuthContext } from "../auth.ts";

const router = new Hono<AuthContext>();

router.get("/", async (c) => {
  const sb = requestClient(c);
  const projectId = Number(c.req.param("projectId"));
  if (!Number.isInteger(projectId)) return errorResponse(c, "VALIDATION_ERROR", "Bad id");

  const { data, error } = await sb
    .from("experiments")
    .select("id,name,status,task_type,created_at,completed_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) return errorResponse(c, "INTERNAL_ERROR", error.message);
  return c.json(data ?? []);
});

export default router;