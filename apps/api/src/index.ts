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

const app = new Hono<AuthContext>().basePath("/api/v1");

// Public.
app.get("/health", (c) => c.json({ ok: true }));

// Auth gate below.
app.use("*", requireAuth);

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

// --- Predictions ---
app.route("/experiments", predictionsRouter);

const port = env.API_PORT;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port}`);
});

export type AppType = typeof app;
export default app;