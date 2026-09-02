import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { requireAuth, type AuthContext } from "./auth.ts";
import { env } from "./env.ts";
import projectsRouter from "./routes/projects.ts";
import datasetsRouter, { datasetUpload } from "./routes/datasets.ts";
import modelsRouter from "./routes/models.ts";
import experimentsRouter from "./routes/experiments.ts";
import projectExperimentsRouter from "./routes/projectExperiments.ts";
import dashboardsRouter, { dashboardCreate } from "./routes/dashboards.ts";
import predictionsRouter from "./routes/predictions.ts";
import insightsRouter from "./routes/insights.ts";
import authRouter from "./routes/auth.ts";

const app = new Hono<AuthContext>().basePath("/api/v1");

// Public.
app.get("/health", (c) => c.json({ ok: true }));

// Public auth endpoints (signup with auto-confirm). Must be mounted BEFORE
// the auth gate below.
app.route("/auth", authRouter);

// Auth gate below — skip the public auth endpoints (mounted above).
app.use("*", async (c, next) => {
  if (c.req.path.startsWith("/api/v1/auth/")) return next();
  return requireAuth(c, next);
});

// --- Projects ---
app.route("/projects", projectsRouter);
app.route("/projects/:projectId/datasets", datasetUpload);

// --- Datasets read endpoints (top-level) ---
app.route("/datasets", datasetsRouter);

// --- Models registry ---
app.route("/models", modelsRouter);

// --- Experiments ---
app.route("/experiments", experimentsRouter);
app.route("/projects/:projectId/experiments", projectExperimentsRouter);

// --- Dashboards ---
app.route("/dashboards", dashboardsRouter);
app.route("/projects/:projectId/dashboards", dashboardCreate);

// --- Insights catalog ---
app.route("/projects/:projectId/insights", insightsRouter);

// --- Predictions ---
app.route("/experiments", predictionsRouter);

const port = env.API_PORT;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port}`);
});

export type AppType = typeof app;
export default app;