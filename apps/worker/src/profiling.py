"""Dataset profiling per PRD §5.2."""
from __future__ import annotations
import math
from typing import Any
import numpy as np
import pandas as pd


def _safe_float(x: Any) -> float | None:
    try:
        v = float(x)
        if math.isnan(v) or math.isinf(v):
            return None
        return v
    except (TypeError, ValueError):
        return None


def profile_dataset(df: pd.DataFrame) -> dict[str, Any]:
    """Return { general: {...}, columns: [{ name, data_type, nullable, unique_count, missing_count, statistics }] }."""
    general = {
        "rows": int(len(df)),
        "columns": int(len(df.columns)),
        "memory_bytes": int(df.memory_usage(deep=True).sum()),
        "duplicate_rows": int(df.duplicated().sum()),
    }
    columns = []
    for col in df.columns:
        s = df[col]
        missing = int(s.isna().sum())
        unique = int(s.nunique(dropna=True))
        dtype = str(s.dtype)
        if pd.api.types.is_bool_dtype(s):
            data_type = "binary"
        elif pd.api.types.is_numeric_dtype(s):
            data_type = "number"
        elif pd.api.types.is_datetime64_any_dtype(s):
            data_type = "datetime"
        else:
            data_type = "categorical" if unique <= 50 else "text"

        stats: dict[str, Any] = {"data_type": data_type, "unique_count": unique, "missing_count": missing}
        if data_type == "number":
            non_null = s.dropna()
            if len(non_null):
                stats.update({
                    "min": _safe_float(non_null.min()),
                    "max": _safe_float(non_null.max()),
                    "mean": _safe_float(non_null.mean()),
                    "median": _safe_float(non_null.median()),
                    "stddev": _safe_float(non_null.std()),
                    "quartiles": [_safe_float(non_null.quantile(q)) for q in (0.25, 0.5, 0.75)],
                })
        elif data_type == "categorical":
            counts = s.value_counts(dropna=True).head(10)
            stats["top_values"] = [{"value": str(k), "count": int(v)} for k, v in counts.items()]

        columns.append({
            "name": col,
            "data_type": data_type,
            "nullable": missing > 0,
            "unique_count": unique,
            "missing_count": missing,
            "statistics": stats,
        })
    return {"general": general, "columns": columns}