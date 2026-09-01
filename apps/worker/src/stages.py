"""Update experiment current_stage + progress as training progresses."""
from __future__ import annotations
from .supabase_client import get_supabase


class StageReporter:
    def __init__(self, experiment_id: int):
        self.experiment_id = experiment_id
        self._sb = get_supabase()

    def set(self, stage: str, progress: int) -> None:
        self._sb.table("experiments").update(
            {"current_stage": stage, "progress": progress}
        ).eq("id", self.experiment_id).execute()