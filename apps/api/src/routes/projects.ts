// /api/v1/projects — full CRUD. All access is RLS-gated via the caller's JWT.

import { Hono } from "hono";
import { z } from "zod";
import { errorResponse } from "../errors.ts";
import { requestClient, type AuthContext } from "../auth.ts";
import { validateBody } from "../lib/validate.ts";

const router = new Hono<AuthContext>();

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});
const updateSchema = createSchema.partial().extend({
  status: z.enum(["draft", "active", "completed", "archived"]).optional(),
});

router.get("/", async (c) => {
  const sb = requestClient(c);
  const { data, error } = await sb
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return errorResponse(c, "INTERNAL_ERROR", error.message);
  return c.json(data ?? []);
});

router.post("/", validateBody(createSchema), async (c) => {
  const sb = requestClient(c);
  const user = c.get("user");
  const body = c.get("validated" as never) as z.infer<typeof createSchema>;
  const { data, error } = await sb
    .from("projects")
    .insert({ ...body, owner_id: user.id })
    .select("*")
    .single();
  if (error) return errorResponse(c, "INTERNAL_ERROR", error.message);
  return c.json(data, 201);
});

router.get("/:projectId", async (c) => {
  const sb = requestClient(c);
  const id = Number(c.req.param("projectId"));
  if (!Number.isInteger(id)) return errorResponse(c, "VALIDATION_ERROR", "Bad id");
  const { data, error } = await sb.from("projects").select("*").eq("id", id).maybeSingle();
  if (error) return errorResponse(c, "INTERNAL_ERROR", error.message);
  if (!data) return errorResponse(c, "NOT_FOUND");
  return c.json(data);
});

router.patch("/:projectId", validateBody(updateSchema), async (c) => {
  const sb = requestClient(c);
  const id = Number(c.req.param("projectId"));
  if (!Number.isInteger(id)) return errorResponse(c, "VALIDATION_ERROR", "Bad id");
  const body = c.get("validated" as never) as z.infer<typeof updateSchema>;
  const { data, error } = await sb
    .from("projects")
    .update(body)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) return errorResponse(c, "INTERNAL_ERROR", error.message);
  if (!data) return errorResponse(c, "NOT_FOUND");
  return c.json(data);
});

// Soft delete per PRD §4.1: status -> archived. Keeps enum authoritative.
router.delete("/:projectId", async (c) => {
  const sb = requestClient(c);
  const id = Number(c.req.param("projectId"));
  if (!Number.isInteger(id)) return errorResponse(c, "VALIDATION_ERROR", "Bad id");
  const { error: upErr } = await sb
    .from("projects")
    .update({ status: "archived" })
    .eq("id", id);
  if (upErr) return errorResponse(c, "INTERNAL_ERROR", upErr.message);
  return c.json({ success: true });
});

export default router;