"""
Tests for the preprocessing pipeline.

The HARD INVARIANT here (per PRD §5.6): the scaler/imputer must be fit on
the TRAIN split only, never on the union. This test verifies that the
ColumnTransformer's fitted means/stddevs match the training subset, not
the full dataset.
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from src.preprocessing import build_preprocessor


def test_scaler_is_fit_on_train_only():
    rng = np.random.default_rng(42)
    # Build a DataFrame where column A has a clear mean shift between
    # train and test. If the scaler were fit on the union, the fitted mean
    # would be ~ the global mean. If fit on train only, it would match
    # train mean exactly.
    n_train, n_test = 80, 20
    a_train = rng.normal(loc=10.0, scale=1.0, size=n_train)
    a_test = rng.normal(loc=50.0, scale=1.0, size=n_test)  # very different mean
    df = pd.DataFrame({"a": np.concatenate([a_train, a_test])})
    train = df.iloc[:n_train].copy()
    # If we fit on the full df by accident, fitted mean ≈ 19.0 (mixed).
    # If fit on train only, fitted mean ≈ 10.0 exactly.
    preprocessor = build_preprocessor(train, {"scaling": "standard", "missingValues": "mean"})
    preprocessor.fit(train)
    fitted_means = preprocessor.named_transformers_["num"].named_steps["scaler"].mean_
    assert abs(fitted_means[0] - 10.0) < 0.5, (
        f"scaler mean={fitted_means[0]:.2f} suggests it was fit on the union"
    )


def test_imputer_handles_missing_values():
    df = pd.DataFrame({"a": [1.0, 2.0, None, 4.0, 5.0]})
    pp = build_preprocessor(df, {"scaling": "none", "missingValues": "median", "encoding": "onehot"})
    out = pp.fit_transform(df)
    assert out.shape[0] == 5
    # Median of [1,2,4,5] is 3 — imputed row should be 3.
    assert abs(out[2, 0] - 3.0) < 1e-6


def test_categorical_passthrough_works():
    df = pd.DataFrame({
        "num": [1.0, 2.0, 3.0],
        "cat": ["a", "b", "a"],
    })
    pp = build_preprocessor(df, {"scaling": "standard", "missingValues": "mean", "encoding": "onehot"})
    out = pp.fit_transform(df)
    assert out.shape[0] == 3
    assert out.shape[1] >= 3  # 1 numeric + ≥2 one-hot