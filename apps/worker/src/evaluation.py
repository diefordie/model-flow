"""Evaluation: metrics + structured chart data. All outputs JSON-serialisable."""
from __future__ import annotations
from typing import Any
import numpy as np
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, mean_absolute_error, mean_squared_error, r2_score,
    confusion_matrix, silhouette_score,
)


def _to_python(v: Any) -> Any:
    """np types → python builtins so json.dumps doesn't blow up."""
    if isinstance(v, (np.integer,)): return int(v)
    if isinstance(v, (np.floating,)):
        f = float(v)
        return None if (np.isnan(f) or np.isinf(f)) else f
    if isinstance(v, np.ndarray): return v.tolist()
    return v


def _safe_proba(model, X) -> np.ndarray | None:
    """Return positive-class probabilities if the model supports it."""
    if not hasattr(model, "predict_proba"):
        return None
    try:
        return model.predict_proba(X)
    except Exception:
        return None


def evaluate_classification(pipeline, X_test, y_test) -> dict[str, Any]:
    y_pred = pipeline.predict(X_test)
    metrics: dict[str, Any] = {
        "accuracy": _to_python(accuracy_score(y_test, y_pred)),
        "precision": _to_python(precision_score(y_test, y_pred, average="weighted", zero_division=0)),
        "recall": _to_python(recall_score(y_test, y_pred, average="weighted", zero_division=0)),
        "f1": _to_python(f1_score(y_test, y_pred, average="weighted", zero_division=0)),
    }
    proba = _safe_proba(pipeline, X_test)
    if proba is not None and len(np.unique(y_test)) == 2:
        # binary → second column is positive-class prob
        try:
            metrics["roc_auc"] = _to_python(roc_auc_score(y_test, proba[:, 1]))
        except Exception:
            pass

    visualizations: dict[str, Any] = {}
    labels = sorted(np.unique(y_test).tolist())
    cm = confusion_matrix(y_test, y_pred, labels=labels)
    visualizations["confusion_matrix"] = {
        "labels": [str(x) for x in labels],
        "matrix": _to_python(cm),
    }

    if proba is not None and len(labels) == 2:
        visualizations["roc_curve"] = {
            "fpr": _to_python(_roc_fpr(y_test, proba[:, 1])),
            "tpr": _to_python(_roc_tpr(y_test, proba[:, 1])),
            "auc": metrics.get("roc_auc"),
        }

    if hasattr(pipeline.named_steps["model"], "feature_importances_"):
        names = pipeline.named_steps["preprocessor"].get_feature_names_out()
        fi = pipeline.named_steps["model"].feature_importances_
        visualizations["feature_importance"] = {
            "features": [str(n) for n in names],
            "importances": _to_python(fi),
        }

    return {"metrics": metrics, "visualizations": visualizations}


def evaluate_regression(pipeline, X_test, y_test) -> dict[str, Any]:
    y_pred = pipeline.predict(X_test)
    metrics = {
        "mae": _to_python(mean_absolute_error(y_test, y_pred)),
        "mse": _to_python(mean_squared_error(y_test, y_pred)),
        "rmse": _to_python(float(np.sqrt(mean_squared_error(y_test, y_pred)))),
        "r2": _to_python(r2_score(y_test, y_pred)),
    }
    visualizations = {
        "actual_vs_predicted": {
            "actual": _to_python(y_test),
            "predicted": _to_python(y_pred),
        },
        "residual_plot": {
            "predicted": _to_python(y_pred),
            "residuals": _to_python(np.asarray(y_test) - np.asarray(y_pred)),
        },
        "prediction_distribution": {
            "values": _to_python(y_pred),
        },
    }
    if hasattr(pipeline.named_steps["model"], "feature_importances_"):
        names = pipeline.named_steps["preprocessor"].get_feature_names_out()
        fi = pipeline.named_steps["model"].feature_importances_
        visualizations["feature_importance"] = {
            "features": [str(n) for n in names],
            "importances": _to_python(fi),
        }
    return {"metrics": metrics, "visualizations": visualizations}


def evaluate_clustering(pipeline, X) -> dict[str, Any]:
    labels = pipeline.predict(X)
    metrics: dict[str, Any] = {}
    if len(set(labels.tolist())) > 1 and len(set(labels.tolist())) < len(labels):
        try:
            metrics["silhouette"] = _to_python(silhouette_score(X, labels))
        except Exception:
            pass
    counts = {str(k): int(v) for k, v in zip(*np.unique(labels, return_counts=True))}
    visualizations = {
        "cluster_distribution": {"clusters": list(counts.keys()), "counts": list(counts.values())},
    }
    # 2D scatter via PCA — keep in the worker so we don't ship high-dim data to the UI.
    try:
        from sklearn.decomposition import PCA
        if X.shape[1] > 2:
            xy = PCA(n_components=2, random_state=42).fit_transform(X)
        else:
            xy = np.asarray(X)
        visualizations["cluster_scatter"] = {
            "x": _to_python(xy[:, 0]),
            "y": _to_python(xy[:, 1]) if xy.shape[1] > 1 else [0] * len(xy),
            "labels": _to_python(labels),
        }
    except Exception:
        pass
    return {"metrics": metrics, "visualizations": visualizations}


# --- helpers ---
def _roc_fpr(y_true, scores) -> np.ndarray:
    from sklearn.metrics import roc_curve
    fpr, _, _ = roc_curve(y_true, scores)
    return fpr


def _roc_tpr(y_true, scores) -> np.ndarray:
    from sklearn.metrics import roc_curve
    _, tpr, _ = roc_curve(y_true, scores)
    return tpr