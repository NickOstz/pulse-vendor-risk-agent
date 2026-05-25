from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./pulse.db"
    brightdata_api_key: str | None = None
    brightdata_serp_endpoint: str | None = None
    brightdata_web_unlocker_endpoint: str | None = None
    brightdata_serp_zone: str | None = None
    brightdata_unlocker_zone: str | None = None
    brightdata_demo_source_url: str | None = None
    brightdata_live_snapshot_dir: Path | None = None
    brightdata_live_fetch_timeout_seconds: float = 8.0
    deepseek_api_key: str | None = None
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


@lru_cache
def get_settings() -> Settings:
    return Settings()
