import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path: Path) -> TestClient:
    db_path = tmp_path / "pulse-test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path.as_posix()}"
    os.environ["DEFAULT_REVIEW_MODE"] = "replay"
    os.environ.pop("BRIGHTDATA_API_KEY", None)
    os.environ.pop("BRIGHTDATA_SERP_ZONE", None)

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
