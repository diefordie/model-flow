// /api/v1/datasets + /api/v1/projects/:projectId/datasets
//
// PRD §4.2 flow on upload:
//   validate (type, size) → upload to storage → insert row (status=processing)
//   → enqueue profiling job.
//
// Proview / profile / columns are read endpoints; profile is also precomputed
// by the worker into storage at `datasets/{id}/profile.json`.

import { Hono } from "hono";
import { errorResponse } from "../errors.ts";
import { supabaseAdmin, requestClient, type AuthContext } from "../auth.ts";
import { env } from "../env.ts";
import { enqueueJob } from "../lib/queue.ts";

const router = new Hono<AuthContext>();

const MAX_BYTES = 10 * 1024 * 1024; // PRD §8: < 10 MB
const ALLOWED_TYPES = new Set(["csv", "xlsx"]);
const ALLOWED_MIMES = new Set([
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream", // some browsers send generic — we re-check by ext
]);

// --- Upload under the project (nested route) ---
const upload = new Hono<AuthContext>();

// List datasets belonging to a project (PRD §4.2).
upload.get("/", async (c) => {
  const sb = requestClient(c);
  const projectId = Number(c.req.param("projectId"));
  if (!Number.isInteger(projectId)) return errorResponse(c, "VALIDATION_ERROR", "Bad project id");
  const { data, error } = await sb
    .from("datasets")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) return errorResponse(c, "INTERNAL_ERROR", error.message);
  return c.json(data ?? []);
});

upload.post("/", async (c) => {
  const projectId = Number(c.req.param("projectId"));
  if (!Number.isInteger(projectId)) return errorResponse(c, "VALIDATION_ERROR", "Bad project id");

  // Ownership check: confirm the project belongs to the caller before we touch
  // storage. RLS would block the insert anyway, but failing fast saves a roundtrip.
  const sb = requestClient(c);
  const { data: proj, error: projErr } = await sb
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (projErr) return errorResponse(c, "INTERNAL_ERROR", projErr.message);
  if (!proj) return errorResponse(c, "NOT_FOUND", "Project not found");

  const form = await c.req.formData().catch(() => null);
  if (!form) return errorResponse(c, "VALIDATION_ERROR", "Expected multipart/form-data");
  const file = form.get("file");
  if (!(file instanceof File)) return errorResponse(c, "VALIDATION_ERROR", "Missing `file` field");

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_TYPES.has(ext)) return errorResponse(c, "UNSUPPORTED_FILE");
  if (!ALLOWED_MIMES.has(file.type)) return errorResponse(c, "UNSUPPORTED_FILE", `MIME ${file.type} not allowed`);
  if (file.size > MAX_BYTES) return errorResponse(c, "FILE_TOO_LARGE", `Max ${MAX_BYTES} bytes`);

  const user = c.get("user");
  const storagePath = `users/${user.id}/projects/${projectId}/${crypto.randomUUID()}.${ext}`;

  const buf = new Uint8Array(await file.arrayBuffer());
  const up = await supabaseAdmin.storage
    .from(env.SUPABASE_STORAGE_BUCKET_DATASETS)
    .upload(storagePath, buf, { contentType: file.type, upsert: false });
  if (up.error) return errorResponse(c, "DATA_PROCESSING_ERROR", up.error.message);

  const { data: row, error: insErr } = await sb
    .from("datasets")
    .insert({
      project_id: projectId,
      owner_id: user.id,
      name: file.name,
      file_path: storagePath,
      file_type: ext,
      file_size: file.size,
    })
    .select("*")
    .single();
  if (insErr) {
    // Best-effort cleanup of orphan upload.
    await supabaseAdmin.storage.from(env.SUPABASE_STORAGE_BUCKET_DATASETS).remove([storagePath]);
    return errorResponse(c, "INTERNAL_ERROR", insErr.message);
  }

  // Enqueue profiling job (worker Task 9 will fill in row/column counts).
  // Use service-role: queue table is locked down to authenticated users.
  await enqueueJob(supabaseAdmin, {
    type: "profiling",
    dataset_id: row.id,
  });

  return c.json(row, 201);
});

export { upload as datasetUpload };

// --- Top-level dataset read endpoints ---
router.get("/:datasetId", async (c) => {
  const sb = requestClient(c);
  const id = Number(c.req.param("datasetId"));
  if (!Number.isInteger(id)) return errorResponse(c, "VALIDATION_ERROR", "Bad id");
  const { data, error } = await sb.from("datasets").select("*").eq("id", id).maybeSingle();
  if (error) return errorResponse(c, "INTERNAL_ERROR", error.message);
  if (!data) return errorResponse(c, "NOT_FOUND");
  return c.json(data);
});

router.get("/:datasetId/preview", async (c) => {
  const sb = requestClient(c);
  const id = Number(c.req.param("datasetId"));
  if (!Number.isInteger(id)) return errorResponse(c, "VALIDATION_ERROR", "Bad id");
  const page = Math.max(1, Number(c.req.query("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? 20)));

  // First, get the dataset's file_path to resolve the preview object key.
  const { data: ds, error: dsErr } = await sb
    .from("datasets")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();
  if (dsErr) return errorResponse(c, "INTERNAL_ERROR", dsErr.message);
  if (!ds) return errorResponse(c, "NOT_FOUND");

  const key = `datasets/${id}/preview/${page}.json`;
  const dl = await supabaseAdmin.storage.from(env.SUPABASE_STORAGE_BUCKET_DATASETS).download(key);
  if (dl.error) {
    // Fallback: storage object hasn't been written yet (worker hasn't profiled).
    return c.json({ page, limit, rows: [], total: null, hint: "Preview not ready yet" }, 202);
  }
  const text = await dl.data.text();
  return c.json(JSON.parse(text));
});

router.get("/:datasetId/profile", async (c) => {
  const sb = requestClient(c);
  const id = Number(c.req.param("datasetId"));
  if (!Number.isInteger(id)) return errorResponse(c, "VALIDATION_ERROR", "Bad id");

  // Per-column detail lives in DB; aggregate stats from storage if available.
  const { data: cols, error } = await sb
    .from("dataset_columns")
    .select("*")
    .eq("dataset_id", id)
    .order("id");
  if (error) return errorResponse(c, "INTERNAL_ERROR", error.message);

  const { data: ds } = await sb.from("datasets").select("row_count,column_count").eq("id", id).maybeSingle();
  return c.json({
    general: {
      rows: ds?.row_count ?? null,
      columns: ds?.column_count ?? null,
    },
    columns: cols ?? [],
  });
});

router.get("/:datasetId/columns", async (c) => {
  const sb = requestClient(c);
  const id = Number(c.req.param("datasetId"));
  if (!Number.isInteger(id)) return errorResponse(c, "VALIDATION_ERROR", "Bad id");
  const { data, error } = await sb
    .from("dataset_columns")
    .select("id,name,data_type,nullable")
    .eq("dataset_id", id)
    .order("id");
  if (error) return errorResponse(c, "INTERNAL_ERROR", error.message);
  return c.json(data ?? []);
});

export default router;