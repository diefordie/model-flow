"""Profiling handler: download dataset, profile, persist columns + storage object."""
from __future__ import annotations
import io
import json
import pandas as pd
from ..config import settings
from ..profiling import profile_dataset
from ..supabase_client import get_supabase


def handle_profiling(job: dict) -> None:
    sb = get_supabase()
    dataset_id = job["dataset_id"]

    ds = sb.table("datasets").select("*").eq("id", dataset_id).maybe_single().execute().data
    if ds is None:
        raise RuntimeError(f"Dataset {dataset_id} not found")

    # Download file from storage.
    file_bytes = sb.storage.from_(settings.SUPABASE_STORAGE_BUCKET_DATASETS).download(ds["file_path"])
    if file_bytes is None:
        raise RuntimeError("Failed to download dataset")

    if ds["file_type"] == "csv":
        df = pd.read_csv(io.BytesIO(file_bytes))
    else:
        df = pd.read_excel(io.BytesIO(file_bytes))

    report = profile_dataset(df)

    # Persist columns.
    cols = report["columns"]
    if cols:
        # Wipe + rewrite — simpler than diff for MVP.
        sb.table("dataset_columns").delete().eq("dataset_id", dataset_id).execute()
        sb.table("dataset_columns").insert([
            {
                "dataset_id": dataset_id,
                "name": c["name"],
                "data_type": c["data_type"],
                "nullable": c["nullable"],
                "unique_count": c["unique_count"],
                "missing_count": c["missing_count"],
                "statistics": c["statistics"],
            }
            for c in cols
        ]).execute()

    # Update datasets row with row/col counts + schema.
    sb.table("datasets").update({
        "row_count": report["general"]["rows"],
        "column_count": report["general"]["columns"],
        "schema": {c["name"]: c["data_type"] for c in cols},
    }).eq("id", dataset_id).execute()

    # Upload profile JSON to storage for fast read.
    profile_path = f"datasets/{dataset_id}/profile.json"
    sb.storage.from_(settings.SUPABASE_STORAGE_BUCKET_DATASETS).upload(
        profile_path,
        json.dumps(report).encode(),
        {"content-type": "application/json", "upsert": "true"},
    )