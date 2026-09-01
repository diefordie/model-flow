"""
Python mirror of apps/api/src/lib/modelRegistry.ts. Same model ids, same
parameter names. The API registry is the contract source-of-truth; this
table is the implementation lookup.

A sync test runs in CI to catch drift.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Param:
    name: str
    type: str  # "integer" | "number" | "enum" | "boolean"
    default: Any = None
    min: float | None = None
    max: float | None = None
    options: tuple[Any, ...] = ()


@dataclass(frozen=True)
class ModelEntry:
    id: str
    name: str
    parameters: tuple[Param, ...] = field(default_factory=tuple)


MODEL_REGISTRY: dict[str, list[ModelEntry]] = {
    "classification": [
        ModelEntry("logistic_regression", "Logistic Regression",
                   (Param("C", "number", 1.0, 0.001, 100), Param("max_iter", "integer", 100, 50, 5000))),
        ModelEntry("decision_tree_classifier", "Decision Tree",
                   (Param("max_depth", "integer", 10, 1, 100),
                    Param("min_samples_split", "integer", 2, 2, 50),
                    Param("criterion", "enum", "gini", options=("gini", "entropy")))),
        ModelEntry("random_forest_classifier", "Random Forest",
                   (Param("n_estimators", "integer", 100, 10, 1000),
                    Param("max_depth", "integer", 10, 1, 100),
                    Param("min_samples_split", "integer", 2),
                    Param("min_samples_leaf", "integer", 1),
                    Param("criterion", "enum", "gini", options=("gini", "entropy")),
                    Param("random_state", "integer", 42))),
        ModelEntry("knn_classifier", "K-Nearest Neighbors",
                   (Param("n_neighbors", "integer", 5, 1, 50),
                    Param("weights", "enum", "uniform", options=("uniform", "distance")))),
        ModelEntry("svm_classifier", "Support Vector Machine",
                   (Param("C", "number", 1.0, 0.001, 100),
                    Param("kernel", "enum", "rbf", options=("linear", "rbf", "poly")))),
    ],
    "regression": [
        ModelEntry("linear_regression", "Linear Regression", ()),
        ModelEntry("decision_tree_regressor", "Decision Tree Regressor",
                   (Param("max_depth", "integer", 10, 1, 100),
                    Param("min_samples_split", "integer", 2))),
        ModelEntry("random_forest_regressor", "Random Forest Regressor",
                   (Param("n_estimators", "integer", 100, 10, 1000),
                    Param("max_depth", "integer", 10, 1, 100),
                    Param("random_state", "integer", 42))),
    ],
    "clustering": [
        ModelEntry("kmeans", "K-Means",
                   (Param("n_clusters", "integer", 3, 2, 20),
                    Param("random_state", "integer", 42))),
        ModelEntry("dbscan", "DBSCAN",
                   (Param("eps", "number", 0.5, 0.01, 10),
                    Param("min_samples", "integer", 5, 1, 50))),
    ],
}


# sklearn class lookup — pure mapping, no sklearn import at module top
# so the registry is importable without sklearn installed (useful for tests).
SKLEARN_MODELS: dict[str, str] = {
    "logistic_regression": "sklearn.linear_model:LogisticRegression",
    "decision_tree_classifier": "sklearn.tree:DecisionTreeClassifier",
    "random_forest_classifier": "sklearn.ensemble:RandomForestClassifier",
    "knn_classifier": "sklearn.neighbors:KNeighborsClassifier",
    "svm_classifier": "sklearn.svm:SVC",
    "linear_regression": "sklearn.linear_model:LinearRegression",
    "decision_tree_regressor": "sklearn.tree:DecisionTreeRegressor",
    "random_forest_regressor": "sklearn.ensemble:RandomForestRegressor",
    "kmeans": "sklearn.cluster:KMeans",
    "dbscan": "sklearn.cluster:DBSCAN",
}


def get_model_entry(model_type: str) -> ModelEntry | None:
    for entries in MODEL_REGISTRY.values():
        for e in entries:
            if e.id == model_type:
                return e
    return None


def build_model_instance(model_type: str, params: dict[str, Any]):
    """Instantiate an sklearn model from model_type + user params + defaults."""
    import importlib
    entry = get_model_entry(model_type)
    if entry is None:
        raise ValueError(f"Unknown model_type: {model_type}")

    # Merge defaults with user params
    merged: dict[str, Any] = {}
    for p in entry.parameters:
        if p.default is not None:
            merged[p.name] = p.default
    merged.update(params or {})

    # Special cases that need probability=True for ROC AUC etc.
    extra: dict[str, Any] = {}
    if model_type == "svm_classifier":
        extra["probability"] = True
    if model_type == "knn_classifier":
        # KNN doesn't accept random_state
        merged.pop("random_state", None)

    path = SKLEARN_MODELS[model_type]
    module_name, class_name = path.split(":")
    cls = getattr(importlib.import_module(module_name), class_name)
    return cls(**merged, **extra)