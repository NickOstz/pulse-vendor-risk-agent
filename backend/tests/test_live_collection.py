import os
from pathlib import Path

import httpx
from fastapi.testclient import TestClient
import pytest


@pytest.fixture()
def live_client(tmp_path: Path) -> TestClient:
    db_path = tmp_path / "pulse-live-test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path.as_posix()}"
    os.environ["DEFAULT_REVIEW_MODE"] = "live_with_fallback"
    os.environ["BRIGHTDATA_API_KEY"] = "test-api-key"
    os.environ["BRIGHTDATA_SERP_ZONE"] = "test-serp-zone"

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

    os.environ.pop("BRIGHTDATA_API_KEY", None)
    os.environ.pop("BRIGHTDATA_SERP_ZONE", None)
    os.environ["DEFAULT_REVIEW_MODE"] = "replay"
    get_settings.cache_clear()


def _start_live_scan(client: TestClient) -> str:
    company_id = "vendor-dataforge-demo"
    response = client.patch(f"/api/companies/{company_id}/agent", json={"agent_enabled": True})
    assert response.status_code == 200
    tick = client.post("/api/agents/tick")
    assert tick.status_code == 200
    return tick.json()["started_scan_ids"][0]


def _poll_until_terminal(client: TestClient, scan_id: str) -> dict:
    for _ in range(8):
        scan = client.get(f"/api/scans/{scan_id}").json()
        if scan["status"] in {"completed", "completed_with_fallback"}:
            return scan
    raise AssertionError("live-with-fallback scan did not complete")


def test_live_serp_attempt_is_traced_before_labeled_fallback(monkeypatch, live_client):
    captured = {}

    def fake_post(url, *, headers, json, timeout):
        captured.update(url=url, headers=headers, payload=json, timeout=timeout)
        return httpx.Response(200, request=httpx.Request("POST", url), json={"organic": []})

    monkeypatch.setattr("app.services.brightdata_client.httpx.post", fake_post)
    scan_id = _start_live_scan(live_client)

    terminal = _poll_until_terminal(live_client, scan_id)
    traces = live_client.get(f"/api/brightdata/traces?scan_id={scan_id}").json()

    assert terminal["mode"] == "live_with_fallback"
    assert terminal["status"] == "completed_with_fallback"
    assert terminal["metrics"]["serp_queries_used"] == 1
    assert terminal["metrics"]["llm_calls_used"] == 0
    assert captured["payload"]["zone"] == "test-serp-zone"
    assert "brd_json=1" in captured["payload"]["url"]
    assert captured["timeout"] == 8.0
    assert any(trace["source_mode"] == "live" and trace["status"] == "success" for trace in traces)
    assert any(trace["source_mode"] == "fallback" and trace["status"] == "fallback_used" for trace in traces)


def test_timed_out_live_serp_attempt_is_preserved_before_fallback(monkeypatch, live_client):
    def fake_post(url, *, headers, json, timeout):
        raise httpx.TimeoutException("timeout", request=httpx.Request("POST", url))

    monkeypatch.setattr("app.services.brightdata_client.httpx.post", fake_post)
    scan_id = _start_live_scan(live_client)

    terminal = _poll_until_terminal(live_client, scan_id)
    traces = live_client.get(f"/api/brightdata/traces?scan_id={scan_id}").json()

    assert terminal["status"] == "completed_with_fallback"
    assert any(
        trace["source_mode"] == "live"
        and trace["status"] == "timeout"
        and "timeout" in trace["error"].lower()
        for trace in traces
    )
    assert {trace["source_mode"] for trace in traces} == {"live", "fallback"}


def test_timed_out_live_attempt_is_visible_before_fallback_evidence(monkeypatch, live_client):
    def fake_post(url, *, headers, json, timeout):
        raise httpx.TimeoutException("timeout", request=httpx.Request("POST", url))

    monkeypatch.setattr("app.services.brightdata_client.httpx.post", fake_post)
    scan_id = _start_live_scan(live_client)

    first_poll = live_client.get(f"/api/scans/{scan_id}").json()
    traces = live_client.get(f"/api/brightdata/traces?scan_id={scan_id}").json()
    evidence = live_client.get(f"/api/companies/vendor-dataforge-demo/evidence?scan_id={scan_id}").json()

    assert first_poll["status"] == "running"
    assert first_poll["current_stage"] == "collect"
    assert any(trace["source_mode"] == "live" and trace["status"] == "timeout" for trace in traces)
    assert any(trace["source_mode"] == "fallback" and trace["status"] == "fallback_used" for trace in traces)
    assert evidence == []

    terminal = _poll_until_terminal(live_client, scan_id)
    evidence = live_client.get(f"/api/companies/vendor-dataforge-demo/evidence?scan_id={scan_id}").json()

    assert terminal["status"] == "completed_with_fallback"
    assert evidence
    assert all(item["support_status"] == "verified" for item in evidence)
