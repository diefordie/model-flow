"""
API ↔ worker registry sync test.

Both apps/api/src/lib/modelRegistry.ts and apps/worker/src/registry.py must
expose the same model ids per task. This test only checks the worker side
against a hardcoded list — the TS side is the contract source-of-truth,
and a manual scan of both files catches drift.
"""
from src.registry import MODEL_REGISTRY

EXPECTED = {
    "classification": {
        "logistic_regression", "decision_tree_classifier",
        "random_forest_classifier", "knn_classifier", "svm_classifier",
    },
    "regression": {"linear_regression", "decision_tree_regressor", "random_forest_regressor"},
    "clustering": {"kmeans", "dbscan"},
}


def test_all_expected_models_present():
    for task, ids in EXPECTED.items():
        actual = {e.id for e in MODEL_REGISTRY[task]}
        missing = ids - actual
        extra = actual - ids
        assert not missing, f"{task}: missing {missing}"
        assert not extra, f"{task}: unexpected extras {extra}"


def test_each_model_has_at_least_one_param_or_is_known_empty():
    """linear_regression is intentionally param-less; everyone else has params."""
    for entries in MODEL_REGISTRY.values():
        for e in entries:
            if e.id in {"linear_regression"}:
                assert len(e.parameters) == 0
            else:
                assert len(e.parameters) >= 1, f"{e.id} has no params"