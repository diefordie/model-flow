"""Pydantic settings — fail fast at boot if anything required is missing."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_STORAGE_BUCKET_DATASETS: str = "datasets"
    SUPABASE_STORAGE_BUCKET_MODELS: str = "models"
    API_INTERNAL_URL: str = "http://localhost:3001"
    WORKER_CALLBACK_SECRET: str = ""
    POLL_INTERVAL_SECONDS: float = 2.0
    WORKER_ID: str = "worker-local-1"
    WORKER_PORT: int = 8001


settings = Settings()  # type: ignore[call-arg]