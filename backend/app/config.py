from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./pulse.db"
    cors_allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    brightdata_api_key: str | None = None
    brightdata_serp_endpoint: str | None = None
    brightdata_web_unlocker_endpoint: str | None = None
    brightdata_serp_zone: str | None = None
    brightdata_unlocker_zone: str | None = None
    brightdata_demo_source_url: str | None = None
    brightdata_live_snapshot_dir: Path | None = None
    brightdata_live_fetch_timeout_seconds: float = 8.0
    deepseek_api_key: str | None = None
    deepseek_api_endpoint: str = "https://api.deepseek.com/chat/completions"
    deepseek_extraction_model: str = "deepseek-v4-flash"
    llm_extraction_enabled: bool = False
    llm_extraction_timeout_seconds: float = 12.0
    openai_api_key: str | None = None
    default_review_mode: str = "live_with_fallback"
    demo_api_token: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("brightdata_live_snapshot_dir", mode="before")
    @classmethod
    def blank_snapshot_dir_uses_default(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @property
    def replay_dir(self) -> Path:
        return Path(__file__).parent / "seeds"

    @property
    def brightdata_request_endpoint(self) -> str:
        return self.brightdata_serp_endpoint or "https://api.brightdata.com/request"

    @property
    def brightdata_unlocker_request_endpoint(self) -> str:
        return self.brightdata_web_unlocker_endpoint or "https://api.brightdata.com/request"

    @property
    def live_snapshot_dir(self) -> Path:
        return self.brightdata_live_snapshot_dir or Path(__file__).parent / "snapshots" / "live"

    @property
    def allowed_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_allowed_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
