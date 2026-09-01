"""Training handler: orchestrates the full ML pipeline per PRD §5.7."""
from __future__ import annotations
import io
import json
import platform
import sklearn
import pandas as pd
from sklearn.model_selection import train_test_split

from ..config import settings
from ..evaluation import evaluate_classification, evaluate_regression, evaluate_clustering
from ..preprocessing import build_preprocessor, full_pipeline
from ..registry import build_model_instance
from ..serialization import serialize_pipeline
from ..stages import StageReporter
from ..supabase_client import get_supabase


def _download_dataset(sb, file_path: str, file_type: str) -> pd.DataFrame:
    raw = sb.storage.from_(settings.SUPABASE_STORAGE_BUCKET_DATASETS).download(file_path)
    if raw is None:
        raise RuntimeError("Failed to download dataset")
    buf = io.BytesIO(raw)
    return pd.read_csv(buf) if file_type == "csv" else pd.read_excel(buf)


def handle_training(job: dict) -> None:
    sb = get_supabase()
    experiment_id = job["experiment_id"]

    exp = sb.table("experiments").select("*").eq("id", experiment_id).maybe_single().execute().data
    ds = sb.table("datasets").select("*").eq("id", exp["dataset_id"]).maybe_single().execute().data
    if exp is None or ds is None:
        raise RuntimeError("Experiment or dataset missing")

    cfg = sb.table("model_configs").select("*").eq("experiment_id", experiment_id).maybe_single().execute().data
    pp_cfg_row = sb.table("preprocessing_configs").select("*").eq("experiment_id", experiment_id).maybe_single().execute().data
    pp_cfg = (pp_cfg_row or {}).get("config", {}) or {}

    stages = StageReporter(experiment_id)
    stages.set("Loading Dataset", 5)
    df = _download_dataset(sb, ds["file_path"], ds["file_type"])

    stages.set("Validating Data", 10)
    target = exp.get("target_column")
    features = exp.get("feature_columns") or []
    if exp["task_type"] != "clustering" and (not target or target not in df.columns):
        raise ValueError(f"Target '{target}' not in dataset")
    for f in features:
        if f not in df.columns:
            raise ValueError(f"Feature '{f}' not in dataset")

    stages.set("Preprocessing", 20)
    test_size = float(pp_cfg.get("testSize", 0.2))
    random_state = int(pp_cfg.get("randomState", 42))

    if exp["task_type"] == "clustering":
        X = df[features].copy()
        y = None
    else:
        X = df[features].copy()
        y = df[target].copy()

    stages.set("Splitting Dataset", 30)
    if y is not None:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state, stratify=y if exp["task_type"] == "classification" else None
        )
    else:
        X_train, X_test = X, X  # clustering: evaluate on all

    # Preprocessor is fit ONLY on train — see PRD §5.6.
    preprocessor = build_preprocessor(X_train, pp_cfg)
    model = build_model_instance(cfg["model_type"], cfg.get("hyperparameters") or {})
    pipeline = full_pipeline(preprocessor, model)

    stages.set("Training", 40)
    from ..training import fit as fit_pipeline
    result = fit_pipeline(
        pipeline,
        X_train, y_train if y is not None else X_train,
        {
            "optimization_method": cfg["optimization_method"],
            "hyperparameters": cfg.get("hyperparameters") or {},
            "cv_folds": cfg.get("cv_folds"),
            "scoring": cfg.get("scoring"),
        },
    )
    fitted = result["pipeline"]

    if cfg["optimization_method"] != "manual":
        stages.set("Cross Validation", 60)

    stages.set("Evaluating", 75)
    if exp["task_type"] == "classification":
        eval_out = evaluate_classification(fitted, X_test, y_test)
    elif exp["task_type"] == "regression":
        eval_out = evaluate_regression(fitted, X_test, y_test)
    else:
        eval_out = evaluate_clustering(fitted, X_test)

    # Persist metrics + results.
    if eval_out["metrics"]:
        sb.table("experiment_metrics").delete().eq("experiment_id", experiment_id).execute()
        sb.table("experiment_metrics").insert([
            {"experiment_id": experiment_id, "metric_name": k, "metric_value": float(v)}
            for k, v in eval_out["metrics"].items()
            if v is not None and not isinstance(v, str)
        ]).execute()
    if eval_out["visualizations"]:
        sb.table("experiment_results").delete().eq("experiment_id", experiment_id).execute()
        sb.table("experiment_results").insert([
            {"experiment_id": experiment_id, "result_type": k, "result_data": v}
            for k, v in eval_out["visualizations"].items()
        ]).execute()

    stages.set("Generating Insights", 90)
    artifact_bytes = serialize_pipeline(fitted)
    storage_path = f"projects/{exp['project_id']}/experiments/{experiment_id}/pipeline.joblib"
    sb.storage.from_(settings.SUPABASE_STORAGE_BUCKET_MODELS).upload(
        storage_path,
        artifact_bytes,
        {"content-type": "application/octet-stream", "upsert": "true"},
    )

    # Build feature_importance as its own result type for the API to surface separately.
    fi = eval_out["visualizations"].get("feature_importance")

    metadata = {
        "sklearn_version": sklearn.__version__,
        "python_version": platform.python_version(),
        "best_params": result.get("best_params"),
        "cv_score": result.get("cv_score"),
        "model_type": cfg["model_type"],
    }

    sb.table("model_artifacts").upsert({
        "experiment_id": experiment_id,
        "owner_id": exp["owner_id"],
        "storage_path": storage_path,
        "bytes": len(artifact_bytes),
        "metadata": metadata,
    }).execute()

    sb.table("experiments").update({
        "status": "completed",
        "completed_at": "now()",
        "current_stage": "Completed",
        "progress": 100,
    }).eq("id", experiment_id).execute()

    # Surface feature importance as its own row.
    if fi:
        sb.table("experiment_results").upsert({
            "experiment_id": experiment_id,
            "result_type": "feature_importance",
            "result_data": dict(zip(fi["features"], fi["importances"])),
        }).execute()