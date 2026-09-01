"""Pickle the full pipeline (preprocessor + model) and upload to storage."""
from __future__ import annotations
import io
import joblib


def serialize_pipeline(pipeline) -> bytes:
    buf = io.BytesIO()
    joblib.dump(pipeline, buf)
    return buf.getvalue()