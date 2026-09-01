// /api/v1/experiments/:experimentId/predict
//
// Per plan: prediction runs in the Python worker (it owns the pickle).
// This route validates input, then proxies to WORKER via fetch.

import { Hono } from "hono";
import { z } from "zod";
import { errorResponse } from "../errors.ts";
import { requestClient, type AuthContext } from "../auth.ts";
import { validateBody } from "../lib/validate.ts";
import { env } from "../env.ts";

const router = new Hono<AuthContext>();

const predictSchema = z.object({
  features: z.record(z.union([z.number(), z.string()])),
});

router.post("/:experimentId/predict", validateBody(predictSchema), async (c) => {
  const sb = requestClient(c);
  const experimentId = Number(c.req.param("experimentId"));
  if (!Number.isInteger(experimentId)) return errorResponse(c, "VALIDATION_ERROR", "Bad id");

  const { data: exp } = await sb
    .from("experiments")
    .select("id,status")
    .eq("id", experimentId)
    .maybeSingle();
  if (!exp) return errorResponse(c, "NOT_FOUND");
  if (exp.status !== "completed") {
    return errorResponse(c, "INVALID_CONFIGURATION", "Experiment not completed");
  }

  const body = c.get("validated" as never) as z.infer<typeof predictSchema>;

  const workerUrl = process.env.WORKER_INTERNAL_URL ?? "http://localhost:8001";
  const resp = await fetch(`${workerUrl}/worker/internal/predict`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-worker-secret": env.WORKER_CALLBACK_SECRET,
    },
    body: JSON.stringify({ experimentId, features: body.features }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    return errorResponse(c, "MODEL_ERROR", `worker: ${text}`);
  }
  return c.json(await resp.json());
});

export default router;