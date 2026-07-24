from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_DB = _BACKEND_ROOT / "data" / "orbit.db"
_DEFAULT_CHROMA = _BACKEND_ROOT / "data" / "chroma"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    orbit_api_host: str = "127.0.0.1"
    orbit_api_port: int = 18765
    orbit_database_url: str = f"sqlite:///{_DEFAULT_DB.as_posix()}"
    orbit_log_level: str = "info"
    app_name: str = "Orbit API"
    app_version: str = "0.3.0"
    orbit_chroma_path: str = Field(default_factory=lambda: str(_DEFAULT_CHROMA))
    openai_api_key: str | None = None


settings = Settings()
