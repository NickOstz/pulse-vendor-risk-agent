import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    db_path = tmp_path / "pulse-test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
    monkeypatch.setenv("DEFAULT_REVIEW_MODE", "replay")
    monkeypatch.setenv("BRIGHTDATA_API_KEY", "")
    monkeypatch.setenv("BRIGHTDATA_SERP_ZONE", "")
    monkeypatch.setenv("BRIGHTDATA_UNLOCKER_ZONE", "")
    monkeypatch.setenv("BRIGHTDATA_DEMO_SOURCE_URL", "")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "")
    monkeypatch.setenv("LLM_EXTRACTION_ENABLED", "false")

    from app.config import get_settings

    get_settings.cache_clear()

    import app.db as db
    from app.main import create_app

    db.engine = db.create_engine(
        os.environ["DATABASE_URL"],
        connect_args={"check_same_thread": False},
    )
    with TestClient(create_app()) as test_client:
        yield test_client
    get_settings.cache_clear()
