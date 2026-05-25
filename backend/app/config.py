from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./pulse.db"
    brightdata_api_key: str | None = None
    brightdata_serp_endpoint: str | None = None
    brightdata_web_unlocker_endpoint: str | None = None
    brightdata_serp_zone: str | None = None
    brightdata_unlocker_zone: str | None = None
    deepseek_api_key: str | None = None
    openai_api_key: str | None = None
    default_review_mode: str = "live_with_fallback"
    demo_api_token: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def replay_dir(self) -> Path:
        return Path(__file__).parent / "seeds"


@lru_cache
def get_settings() -> Settings:
    return Settings()
