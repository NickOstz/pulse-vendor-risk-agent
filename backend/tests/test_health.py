from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app


def test_health_reports_database_scheduler_and_replay(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] is True
    assert body["scheduler"] is True
    assert body["replay_data"] is True
    assert body["brightdata_key_present"] is False
    assert body["llm_key_present"] is False


def test_configured_hosted_frontend_origin_passes_cors_preflight(monkeypatch):
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "https://pulse.example")
    get_settings.cache_clear()

    response = TestClient(create_app()).options(
        "/api/health",
        headers={
            "Origin": "https://pulse.example",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://pulse.example"
    get_settings.cache_clear()
