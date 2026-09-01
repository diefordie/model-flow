# ModelFlow Backend Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build the ModelFlow backend: Hono API + Python ML worker + Supabase (Postgres/Storage/Auth), integrated with the existing Nuxt frontend.

**Architecture:**
- **Frontend (existing, Nuxt)**: unchanged — talks to Hono via REST `/api/v1`.
- **Backend**: Hono (Node, TS) — single deployable. Validates requests, owns DB writes via `@supabase/supabase-js` (service-role), uploads datasets to Supabase Storage, enqueues jobs, exposes status.
- **Worker**: Python (FastAPI consumer + sklearn worker). Polls a Postgres-backed queue (`experiment_jobs` table with `FOR UPDATE SKIP LOCKED`), trains, writes metrics/results/model artifact back via REST to Hono using service-role token.
- **Persistence**: Supabase managed Postgres. Schema lives in `supabase/migrations/*.sql`. Storage bucket `datasets` + `models` configured with RLS.
- **Auth**: Supabase Auth (email/password). Frontend uses `supabase-js` anon client to mint JWT; Hono validates JWT on every request.

**Tech Stack:**
- Hono 4 + `@hono/node-server` + `@supabase/supabase-js` + `zod`
- Python 3.11 + `pandas` + `scikit-learn` + `supabase-py` + `fastapi` (for writeback callback only)
- Supabase: Postgres + Auth + Storage
- Queue: Postgres `experiment_jobs` table polled by worker (no Redis)

**Mapping to PRD:**
| PRD | Implementation |
|---|---|
| Hono API | `apps/api/` (Hono) |
| Python Worker | `apps/worker/` (Python) |
| PostgreSQL | Supabase managed |
| Object storage | Supabase Storage buckets `datasets`, `models` |
| Job queue | Postgres `experiment_jobs` (no external broker) |
| Auth | Supabase Auth (JWT validated by Hono) |

---

## Repository layout

```
model-flow/
├── app/                          # Nuxt frontend (existing — untouched)
├── supabase/
│   ├── migrations/
│   │   └── 0001_init.sql         # Full schema (9 tables, indexes, enums, RLS)
│   └── seed.sql                  # Optional dev seed
├── apps/
│   ├── api/                      # Hono backend
│   │   ├── src/
│   │   │   ├── index.ts          # Server bootstrap
│   │   │   ├── env.ts            # Zod-validated env
│   │   │   ├── supabase.ts       # Supabase clients (admin + per-request)
│   │   │   ├── auth.ts           # JWT validation middleware
│   │   │   ├── errors.ts         # Error envelope helpers
│   │   │   ├── routes/
│   │   │   │   ├── projects.ts
│   │   │   │   ├── datasets.ts
│   │   │   │   ├── models.ts
│   │   │   │   ├── experiments.ts
│   │   │   │   ├── dashboards.ts
│   │   │   │   └── predictions.ts
│   │   │   └── lib/
│   │   │       ├── queue.ts      # Enqueue helper (inserts into experiment_jobs)
│   │   │       └── validate.ts   # zod helpers
│   │   ├── tests/
│   │   │   ├── projects.test.ts
│   │   │   ├── experiments.test.ts
│   │   │   └── helpers.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── .env.example
│   └── worker/                   # Python ML worker
│       ├── pyproject.toml
│       ├── src/
│       │   ├── main.py           # Entrypoint (poller loop)
│       │   ├── config.py
│       │   ├── supabase_client.py
│       │   ├── registry.py       # Model registry (per 05 §3)
│       │   ├── preprocessing.py  # Fit-on-train-only pipeline
│       │   ├── training.py       # Train + CV + tuning
│       │   ├── evaluation.py     # Metrics + chart JSON
│       │   ├── serialization.py  # Pickle full pipeline
│       │   └── stages.py         # Stage progression callbacks
│       ├── tests/
│       │   ├── test_pipeline.py
│       │   └── test_registry.py
│       └── .env.example
├── packages/
│   └── shared/                   # Shared TS types
│       └── src/types.ts
├── .env.example
├── package.json                  # Root workspaces
└── README.md
```

---

## Conventions

- **Branches**: one branch per task group — `feat/backend-scaffold`, `feat/db-schema`, `feat/api-projects`, `feat/api-datasets`, `feat/api-experiments`, `feat/worker-pipeline`. Merge to `main` after each.
- **Commits**: conventional (`feat:`, `fix:`, `chore:`, `test:`). Per-task commit minimum.
- **Tests**: vitest (api), pytest (worker). All pass before merge.
- **No dead code**: every endpoint and worker stage serves the PRD.

---

## Tasks

### Task 1: Repository scaffold + monorepo workspace

**Objective:** Wire up the existing Nuxt repo into a pnpm workspace with `apps/api` and `apps/worker` skeletons, root scripts, and shared `.env.example`.

**Files:**
- Create: `package.json` (root, workspaces)
- Create: `pnpm-workspace.yaml`
- Create: `.env.example`
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/src/index.ts`, `apps/api/.env.example`
- Create: `apps/worker/pyproject.toml`, `apps/worker/src/main.py`, `apps/worker/.env.example`
- Create: `packages/shared/package.json`, `packages/shared/src/types.ts`

**Step 1:** Initialize root `package.json` with `private: true` and workspaces `["app", "apps/*", "packages/*"]`. Scripts: `dev:api`, `dev:worker`, `dev:web`, `build`, `test`.

**Step 2:** Create `pnpm-workspace.yaml` listing the same globs.

**Step 3:** Write `apps/api/src/index.ts` with a Hono app returning `{ ok: true }` on `GET /api/v1/health`. Bind to `PORT` env. Wire `@hono/node-server`.

**Step 4:** Write `apps/worker/src/main.py` printing "worker alive" and exiting (placeholder for the poller, replaced in Task 7).

**Step 5:** Write `packages/shared/src/types.ts` with the request/response types for every PRD endpoint (`CreateProjectInput`, `CreateExperimentInput`, `ExperimentStatus`, etc.). Re-export via `package.json` `exports`.

**Step 6:** Write root `.env.example` listing every env var consumed by API + worker + frontend (Supabase URL, anon key, service role key, storage bucket names, JWT secret, API port).

**Step 7:** `pnpm install` from root — verify workspaces resolve, `pnpm --filter api dev` boots Hono on the configured port.

**Verify:** `curl http://localhost:3001/api/v1/health` → `{"ok":true}`. `python apps/worker/src/main.py` → "worker alive". Commit `chore: scaffold monorepo`.

---

### Task 2: Supabase schema migration (9 tables + enums + indexes)

**Objective:** Apply PRD §3 schema to Supabase Postgres as a single reversible migration.

**Files:**
- Create: `supabase/migrations/0001_init.sql`

**Step 1:** Enable extensions: `pgcrypto` (UUID v4 fallback), `pg_stat_statements` (optional, dev perf).

**Step 2:** Create enums:
- `project_status`: `draft`, `active`, `completed`, `archived`
- `experiment_status`: `queued`, `running`, `completed`, `failed`, `cancelled`
- `optimization_method`: `manual`, `grid_search`, `random_search`
- `task_type`: `classification`, `regression`, `clustering`

**Step 3:** Create all 9 tables from PRD §3 verbatim, plus:
- `experiment_jobs` (queue table for worker): `id uuid PK`, `experiment_id uuid FK`, `status enum experiment_status`, `claimed_at timestamptz`, `claimed_by text`, `payload jsonb`, `error text`, `created_at timestamptz`.
- `model_artifacts`: `experiment_id uuid PK FK`, `storage_path text`, `bytes bigint`, `metadata jsonb`, `created_at timestamptz`.

**Step 4:** Indexes per PRD §3 notes:
- `experiments(project_id, status)`
- `experiment_metrics(experiment_id, metric_name)`
- `experiment_jobs(status, claimed_at)` — for worker polling.
- `datasets(project_id)`.

**Step 5:** Row-Level Security: enable on `projects`, `datasets`, `experiments`, `dashboards`, `experiment_metrics`, `experiment_results`, `preprocessing_configs`, `model_configs`, `model_artifacts`. Policies: `auth.uid() = owner_id` for SELECT/INSERT/UPDATE/DELETE on each table.

Wait — PRD doesn't define `owner_id`. **Decision:** add `owner_id uuid` (Supabase auth uid) to every user-owned table. Update PRD in a follow-up commit; for now it's needed for RLS.

**Step 6:** Write a `down` comment block (Supabase CLI doesn't auto-rollback; documented reversal in a separate `0001_init.down.sql` file).

**Verify:** `supabase db push` (or apply via MCP / SQL editor) — all 9 tables + 2 helper tables present, enums created, indexes built. RLS enabled.

Commit `feat(db): initial schema migration`.

---

### Task 3: Supabase clients + auth middleware

**Objective:** Wire Hono to Supabase and validate JWTs on every protected route.

**Files:**
- Modify: `apps/api/src/index.ts`
- Create: `apps/api/src/env.ts`
- Create: `apps/api/src/supabase.ts`
- Create: `apps/api/src/auth.ts`
- Create: `apps/api/src/errors.ts`
- Create: `apps/api/src/lib/validate.ts`

**Step 1:** `env.ts` — zod schema for `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`, `PORT`, `STORAGE_BUCKET_DATASETS`, `STORAGE_BUCKET_MODELS`, `WORKER_CALLBACK_SECRET`. Export typed `env`.

**Step 2:** `supabase.ts` — two clients: `supabaseAdmin` (service role, bypasses RLS, server-only) and a factory `supabaseForRequest(jwt)` returning per-request client with that user's JWT (so RLS applies). Both typed against generated DB types (Task 6 will add codegen; for now plain typed).

**Step 3:** `auth.ts` — Hono middleware `requireAuth` that reads `Authorization: Bearer <jwt>`, verifies via `supabaseAdmin.auth.getUser(jwt)`, attaches `user` to context. On failure return 401 with the standard error envelope from PRD §7.

**Step 4:** `errors.ts` — `errorResponse(code, message, status)` helper producing the `{ success:false, error:{code,message} }` envelope. Include the full code list from PRD §7 as constants.

**Step 5:** `lib/validate.ts` — `validateBody(schema)` returning a Hono middleware. Invalid → `VALIDATION_ERROR` 400.

**Step 6:** `index.ts` — mount `/api/v1/health` (public). Apply `requireAuth` to `/api/v1/*` excluding health.

**Verify:** Manual curl: invalid token → 401. Valid token → continues to next handler. Add a tiny test `tests/auth.test.ts` that stubs `supabase.auth.getUser`. Commit `feat(api): supabase clients and auth middleware`.

---

### Task 4: Projects + Datasets endpoints

**Objective:** CRUD for projects and dataset upload + preview + profile + columns.

**Files:**
- Create: `apps/api/src/routes/projects.ts`
- Create: `apps/api/src/routes/datasets.ts`
- Modify: `apps/api/src/index.ts`
- Create: `tests/projects.test.ts`, `tests/datasets.test.ts`

**Step 1:** `routes/projects.ts`:
- `GET /projects` — list user's projects (`owner_id = auth.uid()`).
- `POST /projects` — zod validate `{name, description?}`, insert, return row.
- `GET /projects/:id` — fetch + 404 if not owned.
- `PATCH /projects/:id` — partial update.
- `DELETE /projects/:id` — soft delete (set `status='archived'`).

**Step 2:** `routes/datasets.ts`:
- `POST /projects/:projectId/datasets` — multipart upload. Validate `file_type` (`csv`,`xlsx`), `file_size` (≤10MB), MIME. Upload to `datasets` bucket at `users/{uid}/projects/{pid}/{uuid}.{ext}`. Insert dataset row with `status='processing'`. Enqueue a `profiling` job into `experiment_jobs` (or a sibling `dataset_jobs` table — **decision**: reuse `experiment_jobs` with a `type` column).
- `GET /datasets/:id` — metadata.
- `GET /datasets/:id/preview?page=1&limit=20` — worker writes paginated chunks back to a `dataset_previews` table OR a `previews/{id}/{page}.json` storage object. **Decision**: storage object — single read.
- `GET /datasets/:id/profile` — returns `dataset_columns` rows.
- `GET /datasets/:id/columns` — slim version for the target/feature selectors.

**Step 3:** Tests with vitest: use a test client that bypasses auth via a `TEST_JWT` env, hits each endpoint against a dedicated test schema (or transactional rollback per test). At minimum cover: create+get+list+patch+archive happy path; unauthorized 401; bad payload 400.

**Step 4:** Update `index.ts` to mount the two routers under `/api/v1`.

**Verify:** All tests pass. `pnpm --filter api test`. Commit `feat(api): projects and datasets endpoints`.

---

### Task 5: Models registry endpoint

**Objective:** Serve `GET /models?task=...` from a static registry definition.

**Files:**
- Create: `apps/api/src/routes/models.ts`
- Create: `apps/api/src/lib/modelRegistry.ts`

**Step 1:** `lib/modelRegistry.ts` — single export `MODEL_REGISTRY: Record<TaskType, ModelEntry[]>` mirroring PRD §3 (LR/DT/RF/KNN/SVM for classification, LR/DT/RF for regression, KMeans/DBSCAN for clustering). Each entry: `{ id, name, parameters: ParameterDef[] }`.

**Step 2:** `routes/models.ts`:
- `GET /models?task=classification` — return `{ task, models: MODEL_REGISTRY[task] }`.
- 400 `VALIDATION_ERROR` if `task` missing or unknown.

**Verify:** curl with each task returns the expected array. Commit `feat(api): models registry endpoint`.

---

### Task 6: Experiments async lifecycle (queue + status + results)

**Objective:** Create experiment, enqueue job, expose status + results.

**Files:**
- Create: `apps/api/src/routes/experiments.ts`
- Create: `apps/api/src/lib/queue.ts`
- Modify: `apps/api/src/index.ts`
- Create: `tests/experiments.test.ts`

**Step 1:** `lib/queue.ts` — `enqueueExperiment(supabase, experimentId)` inserts a row into `experiment_jobs` with `status='queued'`, `type='training'`, payload `{ experimentId }`.

**Step 2:** `routes/experiments.ts`:
- `POST /projects/:projectId/experiments` — zod validate `{datasetId, taskType, target?, features[], preprocessing, model, training}`. Server-side re-validation per PRD §4 (target exists, no dup features, no target/feature overlap, all referenced columns exist). Insert `experiments`, `preprocessing_configs`, `model_configs`. Insert job. Return `{ experimentId, status: 'queued' }` **within 2s budget**.
- `GET /experiments/:id/status` — returns `{ status, stage, progress }`. Worker writes `stage` + `progress` to a denormalized column on `experiments` (add column in migration: `current_stage text`, `progress smallint`).
- `GET /experiments/:id/results` — joins `experiment_metrics`, `experiment_results`, `model_artifacts`. Returns PRD §4 shape.
- `GET /projects/:projectId/experiments` — list for project.
- `POST /experiments/:id/cancel` — set status to `cancelled` if currently `queued`/`running`.

**Step 3:** Tests: create experiment, assert response in <2s, status returns `queued`, validation rejects bad input.

**Step 4:** Mount in `index.ts`.

**Verify:** All tests pass; response timing measured with a vitest assertion `<2000`. Commit `feat(api): experiments async lifecycle`.

---

### Task 7: Dashboards + Predictions endpoints

**Objective:** Persist dashboards; serve resolved widget data; serve predictions using the saved pipeline.

**Files:**
- Create: `apps/api/src/routes/dashboards.ts`
- Create: `apps/api/src/routes/predictions.ts`
- Create: `apps/api/src/lib/insights.ts`
- Modify: `apps/api/src/index.ts`

**Step 1:** `lib/insights.ts` — `resolveInsights(experiment, results, metrics)` produces widget data for: `dataset_overview`, `correlation`, `feature_importance`, `confusion_matrix`, `roc_curve`, `residual_plot`, `cluster_distribution`, etc. Each insight keyed by `(task_type, model_type)` compatibility table per PRD §11. Unknown key → omit from response.

**Step 2:** `routes/dashboards.ts`:
- `POST /projects/:projectId/dashboards` — validate `{ experimentId, insights[] }`. Filter insights through compatibility table. Insert `dashboards` row with `layout = defaultGridLayout(insights)` (a helper that lays out widgets on a 12-col grid).
- `GET /dashboards/:id` — fetch + resolve insights.
- `PATCH /dashboards/:id` — update `layout` and/or `insights`.

**Step 3:** `routes/predictions.ts`:
- `POST /experiments/:experimentId/predict` — validate `{features: Record<string, number|string>}`. Worker exposes a `GET /worker/internal/pipeline/{experimentId}` endpoint (Task 8) that returns the fitted pipeline as pickle bytes — Hono fetches it, applies `.transform()` then `.predict()`. Returns classification shape or regression shape per PRD §6.

**Step 4:** Mount in `index.ts`.

**Verify:** Curl each. Commit `feat(api): dashboards and predictions endpoints`.

---

### Task 8: Python worker — bootstrap + poller + Supabase client

**Objective:** Build the worker foundation: config, Supabase client, job poller loop.

**Files:**
- Modify: `apps/worker/pyproject.toml`
- Create: `apps/worker/src/config.py`
- Create: `apps/worker/src/supabase_client.py`
- Create: `apps/worker/src/main.py`
- Create: `apps/worker/src/queue.py`

**Step 1:** `pyproject.toml` — Python 3.11, deps: `pandas`, `scikit-learn>=1.4`, `openpyxl`, `supabase>=2.0`, `pyarrow`, `pydantic>=2`, `httpx`, `fastapi`, `uvicorn`, `joblib`. Dev: `pytest`, `ruff`.

**Step 2:** `config.py` — pydantic `Settings`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATASETS_BUCKET`, `MODELS_BUCKET`, `API_INTERNAL_URL`, `WORKER_CALLBACK_SECRET`, `POLL_INTERVAL_SECONDS`, `WORKER_ID`.

**Step 3:** `supabase_client.py` — singleton `supabase` client with service role key (worker is privileged).

**Step 4:** `queue.py` — `claim_next_job(supabase) -> Job | None`:
```sql
update experiment_jobs
set status='running', claimed_at=now(), claimed_by=$WORKER_ID
where id = (
  select id from experiment_jobs
  where status='queued' and type=$TYPE
  order by created_at asc
  for update skip locked
  limit 1
)
returning *;
```
Returns the updated row or `None`.

**Step 5:** `main.py` — FastAPI app with one route `GET /worker/internal/pipeline/{experimentId}` (used by Hono for predictions). Plus a poller loop running every `POLL_INTERVAL_SECONDS`: claim job → dispatch to type-specific handler (Task 9/10) → mark completed/failed. Handler signature: `handle(supabase, job: dict) -> None`.

**Step 6:** uvicorn launches FastAPI on `WORKER_PORT`. Poller runs in a background `asyncio.create_task` started in FastAPI's lifespan.

**Verify:** Worker boots; manual SQL insert of a `queued` job gets claimed within one poll interval; pipeline endpoint 404s for unknown id. Commit `feat(worker): bootstrap and poller`.

---

### Task 9: Worker — dataset profiling + preprocessing

**Objective:** Implement dataset profiling + reusable preprocessing pipeline (fit-on-train-only).

**Files:**
- Create: `apps/worker/src/profiling.py`
- Create: `apps/worker/src/preprocessing.py`
- Create: `apps/worker/src/registry.py`
- Create: `apps/worker/src/handlers/dataset_profile.py`
- Modify: `apps/worker/src/main.py`

**Step 1:** `profiling.py` — `profile_dataset(df) -> { general: {...}, columns: [ColumnProfile] }`. Implements PRD §2 verbatim: numeric stats (min/max/mean/median/stddev/quartiles), categorical (top values/freq), missing counts, unique counts.

**Step 2:** `registry.py` — Python mirror of `modelRegistry.ts`: maps `model_type` → sklearn class + parameter dict. Same id strings as API registry. **Critical**: tests assert API and worker registries stay in sync.

**Step 3:** `preprocessing.py` — `build_pipeline(preprocessing_config, model_id) -> sklearn Pipeline`. Components in PRD-correct order:
```
SimpleImputer → ColumnTransformer(num=StandardScaler/etc, cat=OneHotEncoder) → Model
```
**Hard invariant:** the pipeline is `.fit()` ONLY on the training split. `train_test_split` happens FIRST. Document this in module docstring; add a comment block referencing PRD §6 so future edits don't regress it.

**Step 4:** `handlers/dataset_profile.py` — handler for `type='profiling'` jobs. Downloads dataset from storage, parses CSV/XLSX, runs `profile_dataset`, upserts into `dataset_columns`, updates `datasets.row_count/column_count/schema`, writes `datasets/{id}/profile.json` storage object for fast retrieval.

**Step 5:** Dispatch `type='profiling'` to this handler in `main.py`.

**Verify:** pytest `tests/test_profiling.py` runs against a sample CSV (`tests/fixtures/iris.csv`). Asserts numeric stats, categorical top values, missing counts. Commit `feat(worker): profiling and preprocessing`.

---

### Task 10: Worker — training pipeline + writeback

**Objective:** Full training flow: claim → load → split → fit pipeline → train → tune → evaluate → serialize → write back results.

**Files:**
- Create: `apps/worker/src/training.py`
- Create: `apps/worker/src/evaluation.py`
- Create: `apps/worker/src/serialization.py`
- Create: `apps/worker/src/handlers/experiment_training.py`
- Create: `apps/worker/src/stages.py`
- Modify: `apps/worker/src/main.py`
- Create: `apps/worker/tests/test_pipeline.py`

**Step 1:** `stages.py` — `StageReporter(supabase, experiment_id)` with `set_stage(name, progress)` that updates the `experiments.current_stage` + `experiments.progress`. Stages list per PRD §7.

**Step 2:** `training.py` — `train(experiment, dataset, model_config, preprocessor) -> TrainedPipeline`:
- Build sklearn pipeline (preprocessor + model).
- If `optimization_method='manual'`: fit with given params.
- If `grid_search` or `random_search`: `GridSearchCV` / ` RandomizedSearchCV` with `cv_folds`. Use provided `scoring`.
- Returns the best fitted pipeline + best params + cv results.

**Step 3:** `evaluation.py` — `evaluate(pipeline, X_test, y_test, task_type) -> { metrics, results }`:
- Classification: accuracy, precision, recall, f1 (and ROC-AUC if binary). Visualizations: confusion_matrix, roc_curve (binary), pr_curve (binary), feature_importance (if available), prediction_distribution.
- Regression: MAE, MSE, RMSE, R². Visualizations: actual_vs_predicted, residual_plot, prediction_distribution, feature_importance.
- Clustering: silhouette score. Visualizations: cluster_distribution, cluster_scatter (PCA-2D).
- All outputs are **structured JSON** (not images) per PRD §8.

**Step 4:** `serialization.py` — `serialize(pipeline, experiment_id) -> storage_path`: `joblib.dump` the full pipeline (preprocessor + model) to `models/{project_id}/{experiment_id}/pipeline.joblib`. Upload to `models` bucket. Insert row in `model_artifacts`.

**Step 5:** `handlers/experiment_training.py` — orchestrator:
1. Claim + load experiment + dataset rows.
2. `StageReporter.set_stage('Loading Dataset', 5)` → `set_stage('Validating Data', 10)`.
3. Train/test split (`testSize`, `randomState`).
4. `set_stage('Preprocessing', 20)` → build preprocessor.
5. `set_stage('Splitting Dataset', 30)`.
6. `set_stage('Training', 40)` → `training.train(...)`.
7. If CV: `set_stage('Cross Validation', 60)`.
8. `set_stage('Evaluating', 75)` → `evaluate(...)`.
9. Persist metrics into `experiment_metrics`, results into `experiment_results`.
10. `set_stage('Generating Insights', 90)` → `serialize`.
11. `set_stage('Completed', 100)` → update `experiments.status='completed'`, `completed_at=now()`. Persist reproducibility metadata (sklearn version, python version, params) into `model_artifacts.metadata`.
12. On any exception: `status='failed'`, write error to `experiment_jobs.error`, propagate stack via logging.

**Step 6:** Dispatch `type='training'` in `main.py`.

**Step 7:** `tests/test_pipeline.py`:
- Build the sklearn pipeline from sample config.
- Fit on a synthetic dataset (e.g. `sklearn.datasets.load_iris`).
- Assert accuracy > some threshold.
- Assert feature importance path is emitted.
- Assert serialization round-trip: dump → load → predict on a new row returns same class.
- **Data leakage test**: provide a pipeline that has a bug (e.g. scaler fit on full data before split) and assert that pytest fixture would have caught it — instead, just verify in test that scaler `.mean_` matches training subset only, not the union.

**Verify:** All tests pass. Manual end-to-end with sample CSV: Hono creates experiment → worker claims → DB `experiments.status` becomes `completed` within ~30s for a small dataset. `GET /experiments/:id/results` returns metrics and visualizations. `POST /predict` returns a prediction.

Commit `feat(worker): training pipeline and writeback`.

---

### Task 11: Worker → Hono writeback for predictions

**Objective:** Wire `GET /worker/internal/pipeline/{experimentId}` so Hono can load the pipeline for prediction.

**Files:**
- Modify: `apps/worker/src/main.py`
- Create: `apps/api/src/lib/loadPipeline.ts`

**Step 1:** Worker endpoint `GET /worker/internal/pipeline/{experimentId}` — header `X-Worker-Secret: $WORKER_CALLBACK_SECRET`. Reads `model_artifacts.storage_path`, downloads from `models` bucket, returns raw bytes.

**Step 2:** `apps/api/src/lib/loadPipeline.ts` — `loadPipelineBytes(experimentId)` does a fetch to worker URL with secret header. Caches bytes in-process keyed by `(experimentId, model_artifacts.updated_at)` to avoid refetching for every predict call. Cache TTL 60s.

**Step 3:** `routes/predictions.ts` (Task 7) uses `loadPipelineBytes` + `joblib`-equivalent in Node (we'll shell out to a tiny Python helper or — simpler — call a worker-side `POST /worker/internal/predict` that takes features JSON and returns the prediction, keeping pickle in Python). **Decision change**: shift prediction entirely to worker. New worker route `POST /worker/internal/predict { experimentId, features }` returns the PRD §6 shape. Hono just validates + proxies. Removes the need for a Python pickle loader in Node.

**Step 4:** Update `predictions.ts` to proxy to worker.

**Verify:** Two-step predict: train an experiment → POST predict with feature map → returns `{ prediction, probability }` matching a known sample. Commit `feat(worker): internal predict endpoint`.

---

### Task 12: End-to-end smoke test

**Objective:** Prove the whole stack works against a real Supabase project + a sample CSV.

**Files:**
- Create: `scripts/smoke.sh`
- Create: `scripts/sample_data/iris.csv` (or similar public dataset)

**Step 1:** `scripts/sample_data/iris.csv` — first 30 rows of iris (label included).

**Step 2:** `scripts/smoke.sh`:
1. Mint a test JWT (via Supabase admin API or a seeded user).
2. POST `/projects` → projectId.
3. POST `/projects/:id/datasets` with iris.csv → datasetId.
4. Poll `GET /datasets/:id/profile` until status leaves `processing`.
6. POST `/projects/:id/experiments` with classification config → experimentId.
7. Poll `GET /experiments/:id/status` until `completed` (≤60s).
8. GET `/experiments/:id/results` — assert metrics object non-empty.
9. POST `/experiments/:id/predict` with a known row — assert label matches.

**Verify:** `bash scripts/smoke.sh` exits 0. Commit `test: end-to-end smoke`.

---

## Risks & tradeoffs

- **Postgres-backed queue vs Redis**: chose Postgres (no extra infra). `FOR UPDATE SKIP LOCKED` is fine at MVP scale; revisit if >50 concurrent jobs/sec.
- **XGBoost optional**: deliberately excluded from MVP install; adds native build complexity. Add in Phase 2.
- **Polling vs SSE**: PRD allows polling OR SSE. Going polling-first; SSE is one Hono route change later (Task 7's status endpoint can stream from a Postgres `LISTEN/NOTIFY` channel).
- **Worker→Hono writeback**: worker writes metrics/results directly via Supabase service-role client, **not** through Hono. Simpler, fewer failure modes. Hono remains the read-path authority for the frontend.
- **Pickle for prediction**: keeps serialization Python-native; no Node↔Python FFI cost. Adds one extra internal HTTP hop per predict (cacheable).
- **Owner_id in schema**: PRD omits it but RLS needs it. Added in Task 2. Update PRD afterward as a doc-only commit.

## Open questions

- Should `datasets` bucket be public-readable via signed URLs only? PRD doesn't say. Default: signed URLs only (private bucket).
- Where do `previews/{id}/{page}.json` live? Storage (`datasets/{id}/preview/{page}.json`) or DB (`dataset_previews` table)? Storage — keeps DB small.
- How many `dataset_jobs` types in `experiment_jobs`? Currently 2: `profiling`, `training`. Adding more later is just a `type` enum extension.