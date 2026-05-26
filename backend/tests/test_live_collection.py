import hashlib
import json
import os
from pathlib import Path

import httpx
from fastapi.testclient import TestClient
import pytest
from sqlmodel import Session


@pytest.fixture()
def live_client(tmp_path: Path) -> TestClient:
    db_path = tmp_path / "pulse-live-test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path.as_posix()}"
    os.environ["DEFAULT_REVIEW_MODE"] = "live_with_fallback"
    os.environ["BRIGHTDATA_API_KEY"] = "test-api-key"
    os.environ["BRIGHTDATA_SERP_ZONE"] = "test-serp-zone"
    os.environ["BRIGHTDATA_UNLOCKER_ZONE"] = "test-unlocker-zone"
    os.environ["BRIGHTDATA_DEMO_SOURCE_URL"] = "https://www.cloudflare.com/trust-hub/"
    os.environ["BRIGHTDATA_LIVE_SNAPSHOT_DIR"] = str(tmp_path / "live-snapshots")

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
    os.environ.pop("BRIGHTDATA_UNLOCKER_ZONE", None)
    os.environ.pop("BRIGHTDATA_DEMO_SOURCE_URL", None)
    os.environ.pop("BRIGHTDATA_LIVE_SNAPSHOT_DIR", None)
    os.environ["DEFAULT_REVIEW_MODE"] = "replay"
    get_settings.cache_clear()


def _start_live_scan(client: TestClient) -> str:
    company_id = "vendor-cloudflare-demo"
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
    captured = []

    def fake_post(url, *, headers, json, timeout):
        captured.append({"url": url, "headers": headers, "payload": json, "timeout": timeout})
        if json["zone"] == "test-unlocker-zone":
            return httpx.Response(200, request=httpx.Request("POST", url), text="# Live trust source")
        return httpx.Response(200, request=httpx.Request("POST", url), json={"organic": []})

    monkeypatch.setattr("app.services.brightdata_client.httpx.post", fake_post)
    scan_id = _start_live_scan(live_client)

    terminal = _poll_until_terminal(live_client, scan_id)
    traces = live_client.get(f"/api/brightdata/traces?scan_id={scan_id}").json()

    assert terminal["mode"] == "live_with_fallback"
    assert terminal["status"] == "completed_with_fallback"
    assert terminal["metrics"]["serp_queries_used"] == 1
    assert terminal["metrics"]["urls_scraped"] == 1
    assert terminal["metrics"]["source_count"] == 4
    assert terminal["metrics"]["llm_calls_used"] == 0
    assert captured[0]["payload"]["zone"] == "test-serp-zone"
    assert "brd_json=1" in captured[0]["payload"]["url"]
    assert captured[1]["payload"] == {
        "zone": "test-unlocker-zone",
        "url": "https://www.cloudflare.com/trust-hub/",
        "format": "raw",
        "data_format": "markdown",
    }
    assert {call["timeout"] for call in captured} == {8.0}
    assert any(
        trace["product"] == "serp_api" and trace["source_mode"] == "live" and trace["status"] == "success"
        for trace in traces
    )
    assert any(
        trace["product"] == "web_unlocker" and trace["source_mode"] == "live" and trace["status"] == "success"
        for trace in traces
    )
    assert any(trace["source_mode"] == "fallback" and trace["status"] == "fallback_used" for trace in traces)
    snapshot = Path(os.environ["BRIGHTDATA_LIVE_SNAPSHOT_DIR"]) / f"{scan_id}-configured-source.md"
    assert snapshot.read_text(encoding="utf-8") == "# Live trust source"
    import app.db as db
    from app.models import Scan

    with Session(db.engine) as session:
        saved_scan = session.get(Scan, scan_id)
    expected_hash = f"sha256:{hashlib.sha256(b'# Live trust source').hexdigest()}"
    assert saved_scan is not None
    assert expected_hash in json.loads(saved_scan.content_hashes_json)


def test_unlocker_timeout_is_traced_while_fallback_completes_review(monkeypatch, live_client):
    def fake_post(url, *, headers, json, timeout):
        if json["zone"] == "test-unlocker-zone":
            raise httpx.TimeoutException("timeout", request=httpx.Request("POST", url))
        return httpx.Response(200, request=httpx.Request("POST", url), json={"organic": []})

    monkeypatch.setattr("app.services.brightdata_client.httpx.post", fake_post)
    scan_id = _start_live_scan(live_client)

    terminal = _poll_until_terminal(live_client, scan_id)
    traces = live_client.get(f"/api/brightdata/traces?scan_id={scan_id}").json()

    assert terminal["status"] == "completed_with_fallback"
    assert terminal["metrics"]["urls_scraped"] == 0
    assert terminal["metrics"]["source_count"] == 3
    assert any(
        trace["product"] == "web_unlocker"
        and trace["source_mode"] == "live"
        and trace["status"] == "timeout"
        for trace in traces
    )
    assert not list(Path(os.environ["BRIGHTDATA_LIVE_SNAPSHOT_DIR"]).glob("*.md"))


def test_verified_live_cloudflare_quote_replaces_cached_copy_and_creates_scored_alert(monkeypatch, live_client):
    quote = "Explore our posture around ISO 27001, ISO 27701, PCI DSS, SOC 2 Type II, and others"

    def fake_post(url, *, headers, json, timeout):
        if json["zone"] == "test-unlocker-zone":
            return httpx.Response(
                200,
                request=httpx.Request("POST", url),
                text=f"Compliance resources: **{quote}**.",
            )
        return httpx.Response(200, request=httpx.Request("POST", url), json={"organic": []})

    monkeypatch.setattr("app.services.brightdata_client.httpx.post", fake_post)
    scan_id = _start_live_scan(live_client)

    terminal = _poll_until_terminal(live_client, scan_id)
    evidence = live_client.get(f"/api/companies/vendor-cloudflare-demo/evidence?scan_id={scan_id}").json()
    alerts = live_client.get(f"/api/alerts?company_id=vendor-cloudflare-demo&scan_id={scan_id}").json()
    traces = live_client.get(f"/api/brightdata/traces?scan_id={scan_id}").json()
    brief = live_client.post(
        "/api/briefs/vendor-review",
        json={"company_id": "vendor-cloudflare-demo", "scan_id": scan_id, "format": "markdown"},
    ).json()["content"]
    html_brief = live_client.post(
        "/api/briefs/vendor-review",
        json={"company_id": "vendor-cloudflare-demo", "scan_id": scan_id, "format": "html"},
    ).json()["content"]

    trust_items = [item for item in evidence if item["source_url"] == "https://www.cloudflare.com/trust-hub/"]
    live_alert = next(alert for alert in alerts if alert["title"] == "Live compliance posture captured for renewal review")
    related_alert = next(alert for alert in alerts if alert["alert_type"] == "related_change")

    assert terminal["metrics"]["source_count"] == 3
    assert terminal["metrics"]["evidence_count"] == 3
    assert terminal["metrics"]["verified_count"] == 3
    assert len(trust_items) == 1
    assert trust_items[0]["support_status"] == "verified"
    assert trust_items[0]["quote_match_score"] == 1.0
    assert live_alert["score"] == 62
    assert live_alert["evidence_item_id"] == trust_items[0]["id"]
    assert live_alert["score_factors"]["confidence"] == 0.95
    assert related_alert["title"] == "Renewal checkpoint: live compliance and data residency scope"
    assert related_alert["score"] == 72
    assert trust_items[0]["id"] in related_alert["related_evidence_ids"]
    assert not any(
        trace["source_mode"] == "fallback"
        and trace["source_url"] == "https://www.cloudflare.com/trust-hub/"
        for trace in traces
    )
    assert "1 live and 2 fallback verified public-source signals" in brief
    assert "## Evidence Table" in brief
    assert "| Trust / security | live | verified | https://www.cloudflare.com/trust-hub/" in brief
    assert "<h2>Evidence Table</h2><table>" in html_brief
    assert "<td>live</td><td>verified</td>" in html_brief


def test_opt_in_llm_extraction_validates_live_source_and_counts_call(monkeypatch, live_client):
    quote = "Explore our posture around ISO 27001, ISO 27701, PCI DSS, SOC 2 Type II, and others"
    model_prompts: list[str] = []
    monkeypatch.setenv("LLM_EXTRACTION_ENABLED", "true")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-llm-key")

    from app.config import get_settings

    get_settings.cache_clear()

    def fake_post(url, *, headers, json, timeout):
        if json["zone"] == "test-unlocker-zone":
            return httpx.Response(200, request=httpx.Request("POST", url), text=f"Compliance: {quote}.")
        return httpx.Response(200, request=httpx.Request("POST", url), json={"organic": []})

    def fake_model_call(self, prompt):
        model_prompts.append(prompt)
        return json.dumps(
            {
                "vendor_id": "vendor-cloudflare-demo",
                "signal_type": "trust_security",
                "claim": "Cloudflare publicly identifies compliance resources.",
                "supporting_quote": quote,
                "source_url": "https://www.cloudflare.com/trust-hub/",
                "source_type": "vendor_owned",
                "published_or_captured_at": "2026-05-26T08:00:00Z",
                "severity_hint": "medium",
                "confidence": 0.9,
                "recommended_action": "Review current compliance artifacts.",
            }
        )

    monkeypatch.setattr("app.services.brightdata_client.httpx.post", fake_post)
    monkeypatch.setattr("app.services.extraction.DeepSeekExtractionClient.complete_json", fake_model_call)
    scan_id = _start_live_scan(live_client)

    terminal = _poll_until_terminal(live_client, scan_id)
    evidence = live_client.get(f"/api/companies/vendor-cloudflare-demo/evidence?scan_id={scan_id}").json()

    live_trust = next(
        item
        for item in evidence
        if item["source_url"] == "https://www.cloudflare.com/trust-hub/"
        and item["snapshot_path"].endswith(f"{scan_id}-configured-source.md")
    )
    assert terminal["metrics"]["llm_calls_used"] == 1
    assert live_trust["support_status"] == "verified"
    assert live_trust["claim"] == "Cloudflare publicly identifies compliance resources."
    assert len(model_prompts) == 1


def test_unverified_live_cloudflare_quote_cannot_create_live_alert(monkeypatch, live_client):
    def fake_post(url, *, headers, json, timeout):
        if json["zone"] == "test-unlocker-zone":
            return httpx.Response(200, request=httpx.Request("POST", url), text="# Trust center without certifications")
        return httpx.Response(200, request=httpx.Request("POST", url), json={"organic": []})

    monkeypatch.setattr("app.services.brightdata_client.httpx.post", fake_post)
    scan_id = _start_live_scan(live_client)

    _poll_until_terminal(live_client, scan_id)
    evidence = live_client.get(f"/api/companies/vendor-cloudflare-demo/evidence?scan_id={scan_id}").json()
    alerts = live_client.get(f"/api/alerts?company_id=vendor-cloudflare-demo&scan_id={scan_id}").json()
    brief = live_client.post(
        "/api/briefs/vendor-review",
        json={"company_id": "vendor-cloudflare-demo", "scan_id": scan_id, "format": "markdown"},
    ).json()["content"]

    assert any(
        item["source_url"] == "https://www.cloudflare.com/trust-hub/"
        and item["support_status"] == "needs_review"
        for item in evidence
    )
    assert not any(alert["title"] == "Live compliance posture captured for renewal review" for alert in alerts)
    assert "3 fallback verified public-source signals" in brief
    assert "| Trust / security | fallback | verified | https://www.cloudflare.com/trust-hub/" in brief


@pytest.mark.parametrize(
    "source_url",
    [
        "https://lookalike.example/?next=https://www.cloudflare.com/trust-hub/",
        "https://cloudflare.com/trust-hub/",
        "https://www.cloudflare.com/trust-hub",
    ],
)
def test_unapproved_configured_url_is_not_requested_or_scored(monkeypatch, live_client, source_url):
    captured_zones: list[str] = []

    def fake_post(url, *, headers, json, timeout):
        captured_zones.append(json["zone"])
        return httpx.Response(200, request=httpx.Request("POST", url), json={"organic": []})

    os.environ["BRIGHTDATA_DEMO_SOURCE_URL"] = source_url
    from app.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setattr("app.services.brightdata_client.httpx.post", fake_post)
    scan_id = _start_live_scan(live_client)

    terminal = _poll_until_terminal(live_client, scan_id)
    alerts = live_client.get(f"/api/alerts?company_id=vendor-cloudflare-demo&scan_id={scan_id}").json()
    traces = live_client.get(f"/api/brightdata/traces?scan_id={scan_id}").json()

    assert terminal["metrics"]["urls_scraped"] == 0
    assert captured_zones == ["test-serp-zone"]
    assert not any(trace["source_mode"] == "live" and trace["product"] == "web_unlocker" for trace in traces)
    assert not any(alert["title"] == "Live compliance posture captured for renewal review" for alert in alerts)


def test_empty_unlocker_response_is_not_saved_as_live_source(monkeypatch, live_client):
    def fake_post(url, *, headers, json, timeout):
        if json["zone"] == "test-unlocker-zone":
            return httpx.Response(200, request=httpx.Request("POST", url), text="   ")
        return httpx.Response(200, request=httpx.Request("POST", url), json={"organic": []})

    monkeypatch.setattr("app.services.brightdata_client.httpx.post", fake_post)
    scan_id = _start_live_scan(live_client)

    terminal = _poll_until_terminal(live_client, scan_id)
    traces = live_client.get(f"/api/brightdata/traces?scan_id={scan_id}").json()

    assert terminal["metrics"]["urls_scraped"] == 0
    assert any(
        trace["product"] == "web_unlocker"
        and trace["status"] == "failed"
        and "empty response body" in trace["error"]
        for trace in traces
    )
    assert not list(Path(os.environ["BRIGHTDATA_LIVE_SNAPSHOT_DIR"]).glob("*.md"))


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
    evidence = live_client.get(f"/api/companies/vendor-cloudflare-demo/evidence?scan_id={scan_id}").json()

    assert first_poll["status"] == "running"
    assert first_poll["current_stage"] == "collect"
    assert any(trace["source_mode"] == "live" and trace["status"] == "timeout" for trace in traces)
    assert any(trace["source_mode"] == "fallback" and trace["status"] == "fallback_used" for trace in traces)
    assert evidence == []

    terminal = _poll_until_terminal(live_client, scan_id)
    evidence = live_client.get(f"/api/companies/vendor-cloudflare-demo/evidence?scan_id={scan_id}").json()

    assert terminal["status"] == "completed_with_fallback"
    assert evidence
    assert all(item["support_status"] == "verified" for item in evidence)
