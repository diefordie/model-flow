"""Training entry points: manual + grid + random search."""
from __future__ import annotations
from typing import Any
from sklearn.model_selection import GridSearchCV, RandomizedSearchCV, KFold


def fit(pipeline, X_train, y_train, model_cfg: dict[str, Any]) -> dict[str, Any]:
    """
    Fit according to optimization method.
    Returns { pipeline, best_params, cv_score? }.
    """
    method = model_cfg.get("optimization_method", "manual")
    params = model_cfg.get("hyperparameters") or {}
    cv_folds = model_cfg.get("cv_folds")
    scoring = model_cfg.get("scoring")

    if method == "manual":
        pipeline.fit(X_train, y_train)
        return {"pipeline": pipeline, "best_params": params, "cv_score": None}

    if method == "grid_search":
        search = GridSearchCV(
            pipeline,
            param_grid={"model__" + k: v for k, v in params.items()},
            cv=KFold(n_splits=cv_folds or 5, shuffle=True, random_state=42),
            scoring=scoring,
            n_jobs=-1,
            refit=True,
        )
        search.fit(X_train, y_train)
        return {
            "pipeline": search.best_estimator_,
            "best_params": search.best_params_,
            "cv_score": search.best_score_,
        }

    if method == "random_search":
        search = RandomizedSearchCV(
            pipeline,
            param_distributions={"model__" + k: v for k, v in params.items()},
            n_iter=model_cfg.get("iterations", 20),
            cv=KFold(n_splits=cv_folds or 5, shuffle=True, random_state=42),
            scoring=scoring,
            n_jobs=-1,
            refit=True,
            random_state=42,
        )
        search.fit(X_train, y_train)
        return {
            "pipeline": search.best_estimator_,
            "best_params": search.best_params_,
            "cv_score": search.best_score_,
        }

    raise ValueError(f"Unknown optimization_method: {method}")