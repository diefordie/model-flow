"""
ModelFlow worker — bootstrap.

FastAPI app:
  GET  /health                  — liveness
  POST /worker/internal/predict — Hono-side predictions proxy (Task 11)

Plus a background asyncio task that polls experiment_jobs every
POLL_INTERVAL_SECONDS and dispatches to the right handler.
"""
from __future__ import annotations
import asyncio
import logging
import io
import joblib
from typing import Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Header, Request
from pydantic import BaseModel

from .config import settings
from .queue import claim_next_job, mark_completed, mark_failed
from .handlers.dataset_profile import handle_profiling
from .handlers.experiment_training import handle_training

log = logging.getLogger("worker")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")

HANDLERS: dict[str, Any] = {
    "profiling": handle_profiling,
    "training": handle_training,
}

# Cache for loaded pipelines, keyed by experiment_id. Bytes stay in RAM so
# repeated predictions don't refetch from storage.
_pipeline_cache: dict[int, dict[str, Any]] = {}


class PredictBody(BaseModel):
    experimentId: int
    features: dict[str, Any]


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_poll_forever(), name="worker-poller")
    log.info("worker ready (id=%s, port=%s)", settings.WORKER_ID, settings.WORKER_PORT)
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="modelflow-worker", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, str]:
    return {"ok": "true"}


@app.post("/worker/internal/predict")
async def predict(
    body: PredictBody,
    x_worker_secret: str | None = Header(default=None),
):
    if not settings.WORKER_CALLBACK_SECRET:
        raise HTTPException(500, "WORKER_CALLBACK_SECRET not configured")
    if x_worker_secret != settings.WORKER_CALLBACK_SECRET:
        raise HTTPException(401, "bad worker secret")

    from .supabase_client import get_supabase
    sb = get_supabase()

    # Load (and cache) the fitted pipeline.
    cache_entry = _pipeline_cache.get(body.experimentId)
    if cache_entry is None:
        artifact = (
            sb.table("model_artifacts")
            .select("storage_path,bytes")
            .eq("experiment_id", body.experimentId)
            .maybe_single()
            .execute()
            .data
        )
        if artifact is None:
            raise HTTPException(404, "model artifact missing")
        raw = sb.storage.from_(settings.SUPABASE_STORAGE_BUCKET_MODELS).download(artifact["storage_path"])
        if raw is None:
            raise HTTPException(500, "download failed")
        pipeline = joblib.load(io.BytesIO(raw))
        cache_entry = {"pipeline": pipeline, "bytes": artifact["bytes"]}
        _pipeline_cache[body.experimentId] = cache_entry

    pipeline = cache_entry["pipeline"]
    import pandas as pd
    X = pd.DataFrame([body.features])

    task_type = (
        sb.table("experiments")
        .select("task_type")
        .eq("id", body.experimentId)
        .maybe_single()
        .execute()
        .data
    )["task_type"]

    pred = pipeline.predict(X)
    out: dict[str, Any] = {"prediction": _cast(pred[0])}
    if task_type == "classification" and hasattr(pipeline, "predict_proba"):
        proba = pipeline.predict_proba(X)
        out["probability"] = float(proba[0][-1])
    return out


def _cast(v: Any) -> Any:
    """numpy scalar → python native for json serialisation."""
    try:
        import numpy as np
        if isinstance(v, (np.integer,)): return int(v)
        if isinstance(v, (np.floating,)): return float(v)
    except Exception:
        pass
    return v


async def _poll_forever() -> None:
    """Poll the queue forever; dispatch claimed jobs to handlers."""
    while True:
        try:
            await asyncio.to_thread(_poll_once)
        except Exception:
            log.exception("poll loop error")
        await asyncio.sleep(settings.POLL_INTERVAL_SECONDS)


def _poll_once() -> None:
    for job_type, handler in HANDLERS.items():
        job = claim_next_job(job_type, settings.WORKER_ID)
        if job is None:
            continue
        job_id = job["id"]
        log.info("claimed job id=%s type=%s", job_id, job_type)
        try:
            handler(job)
            mark_completed(job_id)
            log.info("completed job id=%s", job_id)
        except Exception as e:
            log.exception("job id=%s failed", job_id)
            try:
                from .supabase_client import get_supabase
                sb = get_supabase()
                # Mark experiment failed too so the frontend reflects it.
                if job.get("experiment_id"):
                    sb.table("experiments").update({"status": "failed", "current_stage": "failed"}).eq("id", job["experiment_id"]).execute()
                mark_failed(job_id, str(e))
            except Exception:
                log.exception("could not mark job failed")