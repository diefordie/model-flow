"""
Preprocessing pipeline builder.

HARD INVARIANT (PRD §5.6): scalers / imputers / encoders must be fit
ONLY on the training split, then `.transform()` applied to test + future
prediction input. A PR that scales before the split is a bug — see the
test in tests/test_pipeline.py that asserts this ordering.
"""
from __future__ import annotations
from typing import Any
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import (
    StandardScaler, MinMaxScaler, RobustScaler, OneHotEncoder, OrdinalEncoder,
)


def split_numeric_categorical(df: pd.DataFrame) -> tuple[list[str], list[str]]:
    """Pick numeric vs categorical columns by dtype. Cheap heuristic — fine for MVP."""
    numeric = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
    categorical = [c for c in df.columns if c not in numeric]
    return numeric, categorical


def build_preprocessor(
    df: pd.DataFrame,
    cfg: dict[str, Any],
) -> ColumnTransformer:
    """Returns an UNFIT preprocessor that handles numeric + categorical cols.

    Caller is responsible for splitting df into train/test first, then calling
    preprocessor.fit(X_train) — never on the union.
    """
    numeric_cols, categorical_cols = split_numeric_categorical(df)

    scaling = (cfg or {}).get("scaling", "standard")
    scaling_map = {
        "none": None,
        "standard": StandardScaler(),
        "minmax": MinMaxScaler(),
        "robust": RobustScaler(),
    }
    scaler = scaling_map.get(scaling, StandardScaler())

    encoding = (cfg or {}).get("encoding", "onehot")
    encoder: Any = OneHotEncoder(handle_unknown="ignore", sparse_output=False) \
        if encoding == "onehot" else OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)

    numeric_steps = []
    missing = (cfg or {}).get("missingValues", "median")
    if missing != "drop":
        strategy_map = {
            "mean": "mean", "median": "median",
            "most_frequent": "most_frequent", "constant": "constant",
        }
        numeric_steps.append(("imputer", SimpleImputer(strategy=strategy_map.get(missing, "median"))))
    if scaler is not None:
        numeric_steps.append(("scaler", scaler))
    numeric_pipe = Pipeline(numeric_steps) if numeric_steps else "passthrough"

    categorical_steps = []
    if missing != "drop":
        categorical_steps.append(("imputer", SimpleImputer(strategy="most_frequent")))
    categorical_steps.append(("encoder", encoder))
    categorical_pipe = Pipeline(categorical_steps)

    return ColumnTransformer(
        transformers=[
            ("num", numeric_pipe, numeric_cols),
            ("cat", categorical_pipe, categorical_cols),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )


def full_pipeline(preprocessor: ColumnTransformer, model) -> Pipeline:
    """Preprocessor + model in a single fitted Pipeline. Serialised as one artifact."""
    return Pipeline([("preprocessor", preprocessor), ("model", model)])