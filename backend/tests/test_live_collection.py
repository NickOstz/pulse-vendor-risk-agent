import hashlib
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx
from fastapi.testclient import TestClient
import pytest
from sqlmodel import Session


@pytest.fixture()
def live_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    db_path = tmp_path / "pulse-live-test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
    monkeypatch.setenv("DEFAULT_REVIEW_MODE", "live_with_fallback")
    monkeypatch.setenv("BRIGHTDATA_API_KEY", "test-api-key")
    monkeypatch.setenv("BRIGHTDATA_SERP_ZONE", "test-serp-zone")
    monkeypatch.setenv("BRIGHTDATA_UNLOCKER_ZONE", "test-unlocker-zone")
    monkeypatch.setenv("BRIGHTDATA_DEMO_SOURCE_URL", "https://www.cloudflare.com/trust-hub/")
    monkeypatch.setenv("BRIGHTDATA_LIVE_SNAPSHOT_DIR", str(tmp_path / "live-snapshots"))
    monkeypatch.setenv("DEEPSEEK_API_KEY", "")
    monkeypatch.setenv("LLM_EXTRACTION_ENABLED", "false")
    monkeypatch.setenv("DEMO_API_TOKEN", "")

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


def _start_live_scan(client: TestClient) -> str:
    company_id = "vendor-cloudflare-demo"
    response = client.patch(f"/api/companies/{company_id}/agent", json={"agent_enabled": True})
    assert response.status_code == 200
    tick = client.post("/api/agents/tick")
    assert tick.status_code == 200
    return tick.json()["started_scan_ids"][0]


def _create_due_vendor(client: TestClient, allow_list: list[str]) -> tuple[str, str]:
    created = client.post(
        "/api/companies",
        json={
            "name": "SecureForms",
            "domain": "secureforms.example",
            "relationship_type": "documents",
            "owner": "Legal",
            "criticality": "critical",
            "renewal_date": "2026-06-10",
            "allow_list": allow_list,
            "block_list": [],
        },
    )
    assert created.status_code == 201
    company_id = created.json()["id"]
    enabled = client.patch(f"/api/companies/{company_id}/agent", json={"agent_enabled": True})
    assert enabled.status_code == 200
    tick = client.post("/api/agents/tick")
    assert tick.status_code == 200
    assert tick.json()["started_scan_ids"]
    return company_id, tick.json()["started_scan_ids"][0]


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
    assert terminal["metrics"]["serp_queries_used"] == 3
    assert terminal["metrics"]["urls_scraped"] == 1
    assert terminal["metrics"]["source_count"] == 4
    assert terminal["metrics"]["llm_calls_used"] == 0
    assert captured[0]["payload"]["zone"] == "test-serp-zone"
    assert "brd_json=1" in captured[0]["payload"]["url"]
    assert captured[3]["payload"] == {
        "zone": "test-unlocker-zone",
        "url": "https://www.cloudflare.com/trust-hub/",
        "format": "raw",
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
    snapshot = Path(os.environ["BRIGHTDATA_LIVE_SNAPSHOT_DIR"]) / f"{scan_id}-configured-source.txt"
    assert snapshot.read_text(encoding="utf-8") == "# Live trust source"
    import app.db as db
    from app.models import Scan

    with Session(db.engine) as session:
        saved_scan = session.get(Scan, scan_id)
    expected_hash = f"sha256:{hashlib.sha256(b'# Live trust source').hexdigest()}"
    assert saved_scan is not None
    assert expected_hash in json.loads(saved_scan.content_hashes_json)


def test_concurrent_polls_do_not_duplicate_live_collection_calls(monkeypatch, live_client):
    captured: list[str] = []

    def fake_post(url, *, headers, json, timeout):
        captured.append(json["zone"])
        time.sleep(0.05)
        if json["zone"] == "test-unlocker-zone":
            return httpx.Response(200, request=httpx.Request("POST", url), text="# Live trust source")
        return httpx.Response(200, request=httpx.Request("POST", url), json={"organic": []})

    monkeypatch.setattr("app.services.brightdata_client.httpx.post", fake_post)
    scan_id = _start_live_scan(live_client)

    with ThreadPoolExecutor(max_workers=3) as executor:
        poll_responses = list(executor.map(lambda _: live_client.get(f"/api/scans/{scan_id}"), range(3)))

    traces = live_client.get(f"/api/brightdata/traces?scan_id={scan_id}").json()

    assert all(response.status_code == 200 for response in poll_responses)
    assert captured == ["test-serp-zone"] * 3 + ["test-unlocker-zone"]
    assert sum(1 for trace in traces if trace["source_mode"] == "live") == 4


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
        if prompt.startswith("Produce a structured vendor risk assessment"):
            return json.dumps(
                {
                    "executive_summary": "DeepSeek summarized verified Cloudflare renewal evidence.",
                    "risk_interpretation": "Verified public statements require a renewal review.",
                    "recommended_actions": ["Review current compliance artifacts."],
                }
            )
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
    brief = live_client.post(
        "/api/briefs/vendor-review",
        json={"company_id": "vendor-cloudflare-demo", "scan_id": scan_id, "format": "markdown"},
    ).json()["content"]

    live_trust = next(
        item
        for item in evidence
        if item["source_url"] == "https://www.cloudflare.com/trust-hub/"
        and item["snapshot_path"].endswith(f"{scan_id}-configured-source.txt")
    )
    assert terminal["metrics"]["llm_calls_used"] == 2
    assert live_trust["support_status"] == "verified"
    assert live_trust["claim"] == "Cloudflare publicly identifies compliance resources."
    assert "DeepSeek summarized verified Cloudflare renewal evidence." in brief
    assert len(model_prompts) == 2


def test_new_vendor_runs_bounded_live_model_review_from_allowed_vendor_source(monkeypatch, live_client):
    source_url = "https://trust.secureforms.example/security"
    quote = "SOC 2 Type II report is available upon request."
    model_prompts: list[str] = []
    monkeypatch.setenv("LLM_EXTRACTION_ENABLED", "true")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-llm-key")

    from app.config import get_settings

    get_settings.cache_clear()

    def fake_post(url, *, headers, json, timeout):
        if json["zone"] == "test-unlocker-zone":
            assert json["url"] == source_url
            return httpx.Response(200, request=httpx.Request("POST", url), text=f"Security assurance: {quote}")
        return httpx.Response(200, request=httpx.Request("POST", url), json={"organic": []})

    def fake_model_call(self, prompt):
        model_prompts.append(prompt)
        vendor_id = prompt.split("Vendor: SecureForms (", 1)[1].split(")", 1)[0]
        return json.dumps(
            {
                "vendor_id": vendor_id,
                "signal_type": "trust_security",
                "claim": "SecureForms makes a SOC 2 Type II report available on request.",
                "supporting_quote": quote,
                "source_url": source_url,
                "source_type": "vendor_owned",
                "published_or_captured_at": "2026-05-27T08:00:00Z",
                "severity_hint": "medium",
                "confidence": 0.9,
                "recommended_action": "Request the current report for review.",
            }
        )

    monkeypatch.setattr("app.services.brightdata_client.httpx.post", fake_post)
    monkeypatch.setattr("app.services.extraction.DeepSeekExtractionClient.complete_json", fake_model_call)
    company_id, scan_id = _create_due_vendor(live_client, [source_url])

    terminal = _poll_until_terminal(live_client, scan_id)
    traces = live_client.get(f"/api/brightdata/traces?scan_id={scan_id}").json()
    evidence = live_client.get(f"/api/companies/{company_id}/evidence?scan_id={scan_id}").json()
    alerts = live_client.get(f"/api/alerts?company_id={company_id}&scan_id={scan_id}").json()
    brief = live_client.post(
        "/api/briefs/vendor-review",
        json={"company_id": company_id, "scan_id": scan_id, "format": "markdown"},
    ).json()["content"]

    assert terminal["mode"] == "live"
    assert terminal["status"] == "completed"
    assert terminal["metrics"]["llm_calls_used"] == 1
    assert terminal["metrics"]["verified_count"] == 1
    assert {trace["source_mode"] for trace in traces} == {"live"}
    assert any(
        trace["operation"] == "capture_text:trust_security:configured"
        and trace["product"] == "web_unlocker"
        for trace in traces
    )
    assert evidence[0]["source_url"] == source_url
    assert evidence[0]["support_status"] == "verified"
    assert len(alerts) == 1
    assert alerts[0]["title"] == "Verified live trust security signal requires review"
    assert "SecureForms" in alerts[0]["summary"]
    assert "Vendor Risk Assessment Brief: SecureForms" in brief
    assert "cloudflare.com" not in brief.casefold()
    assert len(model_prompts) == 1


def test_serp_discoveries_drive_broad_live_investigation_and_ai_assessment(monkeypatch, live_client):
    source_text = {
        "https://secureforms.example/trust": "SOC 2 Type II report available for customer assurance review.",
        "https://secureforms.example/pricing": "Enterprise renewal pricing now includes an audit export add-on.",
        "https://securitynews.example/secureforms-incident": "SecureForms reported a service incident affecting audit exports.",
    }
    monkeypatch.setenv("LLM_EXTRACTION_ENABLED", "true")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-llm-key")

    from app.config import get_settings

    get_settings.cache_clear()

    def fake_post(url, *, headers, json, timeout):
        if json["zone"] == "test-serp-zone":
            search_url = json["url"]
            if "pricing" in search_url:
                target = "https://secureforms.example/pricing"
            elif "breach" in search_url:
                target = "https://securitynews.example/secureforms-incident"
            else:
                target = "https://secureforms.example/trust"
            return httpx.Response(200, request=httpx.Request("POST", url), json={"organic": [{"link": target}]})
        target = json["url"]
        return httpx.Response(200, request=httpx.Request("POST", url), text=source_text[target])

    def fake_model_call(self, prompt):
        if prompt.startswith("Produce a structured vendor risk assessment"):
            return json.dumps(
                {
                    "executive_summary": "SecureForms has three verified public risk indicators requiring renewal review.",
                    "risk_interpretation": "Verified assurance, commercial, and incident statements justify coordinated review.",
                    "recommended_actions": ["Confirm assurance and incident remediation before renewal."],
                }
            )
        vendor_id = prompt.split("Vendor: SecureForms (", 1)[1].split(")", 1)[0]
        if "/pricing" in prompt:
            signal_type = "pricing_terms"
            source_url = "https://secureforms.example/pricing"
            source_type = "vendor_owned"
            quote = source_text[source_url]
        elif "securitynews.example" in prompt:
            signal_type = "adverse_media"
            source_url = "https://securitynews.example/secureforms-incident"
            source_type = "news"
            quote = source_text[source_url]
        else:
            signal_type = "trust_security"
            source_url = "https://secureforms.example/trust"
            source_type = "vendor_owned"
            quote = source_text[source_url]
        return json.dumps(
            {
                "vendor_id": vendor_id,
                "signal_type": signal_type,
                "claim": f"Verified {signal_type} finding for SecureForms.",
                "supporting_quote": quote,
                "source_url": source_url,
                "source_type": source_type,
                "published_or_captured_at": "2026-05-27T08:00:00Z",
                "severity_hint": "medium",
                "confidence": 0.9,
                "recommended_action": "Review this verified signal.",
            }
        )

    monkeypatch.setattr("app.services.brightdata_client.httpx.post", fake_post)
    monkeypatch.setattr("app.services.extraction.DeepSeekExtractionClient.complete_json", fake_model_call)
    company_id, scan_id = _create_due_vendor(live_client, [])

    terminal = _poll_until_terminal(live_client, scan_id)
    traces = live_client.get(f"/api/brightdata/traces?scan_id={scan_id}").json()
    evidence = live_client.get(f"/api/companies/{company_id}/evidence?scan_id={scan_id}").json()
    alerts = live_client.get(f"/api/alerts?company_id={company_id}&scan_id={scan_id}").json()
    brief = live_client.post(
        "/api/briefs/vendor-review",
        json={"company_id": company_id, "scan_id": scan_id, "format": "markdown"},
    ).json()["content"]

    assert terminal["mode"] == "live"
    assert terminal["metrics"]["serp_queries_used"] == 3
    assert terminal["metrics"]["urls_scraped"] == 3
    assert terminal["metrics"]["llm_calls_used"] == 4
    assert terminal["metrics"]["verified_count"] == 3
    assert {item["signal_type"] for item in evidence} == {"trust_security", "pricing_terms", "adverse_media"}
    assert any(item["source_type"] == "news" for item in evidence)
    assert sum(1 for trace in traces if trace["operation"].endswith(":serp")) == 3
    assert any(alert["alert_type"] == "related_change" for alert in alerts)
    assert "three verified public risk indicators" in brief


def test_repeated_verified_live_finding_is_retained_without_duplicate_alert(monkeypatch, live_client):
    source_url = "https://trust.secureforms.example/security"
    quote = "SOC 2 Type II report is available upon request."
    monkeypatch.setenv("LLM_EXTRACTION_ENABLED", "true")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-llm-key")

    from app.config import get_settings

    get_settings.cache_clear()

    def fake_post(url, *, headers, json, timeout):
        if json["zone"] == "test-unlocker-zone":
            return httpx.Response(200, request=httpx.Request("POST", url), text=quote)
        return httpx.Response(200, request=httpx.Request("POST", url), json={"organic": []})

    def fake_model_call(self, prompt):
        vendor_id = prompt.split("Vendor: SecureForms (", 1)[1].split(")", 1)[0]
        return json.dumps(
            {
                "vendor_id": vendor_id,
                "signal_type": "trust_security",
                "claim": "SecureForms makes a SOC 2 Type II report available on request.",
                "supporting_quote": quote,
                "source_url": source_url,
                "source_type": "vendor_owned",
                "published_or_captured_at": "2026-05-27T08:00:00Z",
                "severity_hint": "medium",
                "confidence": 0.9,
                "recommended_action": "Request the current report for review.",
            }
        )

    monkeypatch.setattr("app.services.brightdata_client.httpx.post", fake_post)
    monkeypatch.setattr("app.services.extraction.DeepSeekExtractionClient.complete_json", fake_model_call)
    company_id, first_scan_id = _create_due_vendor(live_client, [source_url])
    _poll_until_terminal(live_client, first_scan_id)

    live_client.patch(f"/api/companies/{company_id}/agent", json={"agent_enabled": True})
    second_scan_id = live_client.post("/api/agents/tick").json()["started_scan_ids"][0]
    _poll_until_terminal(live_client, second_scan_id)

    second_alerts = live_client.get(f"/api/alerts?company_id={company_id}&scan_id={second_scan_id}").json()
    brief = live_client.post(
        "/api/briefs/vendor-review",
        json={"company_id": company_id, "scan_id": second_scan_id, "format": "markdown"},
    ).json()["content"]

    assert second_alerts == []
    assert "## No New Verified Changes" in brief
    assert "SecureForms makes a SOC 2 Type II report available on request." in brief


def test_new_vendor_ignores_untrusted_configured_url_while_investigating_serp(monkeypatch, live_client):
    captured_zones: list[str] = []
    monkeypatch.setenv("LLM_EXTRACTION_ENABLED", "true")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-llm-key")

    from app.config import get_settings

    get_settings.cache_clear()

    def fake_post(url, *, headers, json, timeout):
        captured_zones.append(json["zone"])
        return httpx.Response(200, request=httpx.Request("POST", url), json={"organic": []})

    monkeypatch.setattr("app.services.brightdata_client.httpx.post", fake_post)
    company_id, scan_id = _create_due_vendor(live_client, ["https://www.cloudflare.com/trust-hub/"])

    terminal = _poll_until_terminal(live_client, scan_id)
    evidence = live_client.get(f"/api/companies/{company_id}/evidence?scan_id={scan_id}").json()
    traces = live_client.get(f"/api/brightdata/traces?scan_id={scan_id}").json()

    assert terminal["mode"] == "live"
    assert terminal["status"] == "completed"
    assert evidence == []
    assert len(traces) == 3
    assert captured_zones == ["test-serp-zone"] * 3


def test_invalid_opt_in_llm_extraction_records_failure_and_preserves_fallback(monkeypatch, live_client):
    quote = "Explore our posture around ISO 27001, ISO 27701, PCI DSS, SOC 2 Type II, and others"
    invalid_responses = iter(
        [
            "not-json",
            '{"claim": "missing required fields"}',
            '{"executive_summary": "missing assessment fields"}',
        ]
    )
    monkeypatch.setenv("LLM_EXTRACTION_ENABLED", "true")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-llm-key")

    from app.config import get_settings

    get_settings.cache_clear()

    def fake_post(url, *, headers, json, timeout):
        if json["zone"] == "test-unlocker-zone":
            return httpx.Response(200, request=httpx.Request("POST", url), text=f"Compliance: {quote}.")
        return httpx.Response(200, request=httpx.Request("POST", url), json={"organic": []})

    def fake_model_call(self, prompt):
        return next(invalid_responses)

    monkeypatch.setattr("app.services.brightdata_client.httpx.post", fake_post)
    monkeypatch.setattr("app.services.extraction.DeepSeekExtractionClient.complete_json", fake_model_call)
    scan_id = _start_live_scan(live_client)

    terminal = _poll_until_terminal(live_client, scan_id)
    evidence = live_client.get(f"/api/companies/vendor-cloudflare-demo/evidence?scan_id={scan_id}").json()
    alerts = live_client.get(f"/api/alerts?company_id=vendor-cloudflare-demo&scan_id={scan_id}").json()
    brief = live_client.post(
        "/api/briefs/vendor-review",
        json={"company_id": "vendor-cloudflare-demo", "scan_id": scan_id, "format": "markdown"},
    ).json()["content"]

    trust_items = [item for item in evidence if item["source_url"] == "https://www.cloudflare.com/trust-hub/"]
    assert terminal["metrics"]["llm_calls_used"] == 3
    assert terminal["metrics"]["verified_count"] == 3
    assert {item["support_status"] for item in trust_items} == {"failed_source", "verified"}
    assert not any(alert["title"] == "Live compliance posture captured for renewal review" for alert in alerts)
    assert "3 fallback verified public-source signals" in brief
    assert "| Trust / security | fallback | verified | https://www.cloudflare.com/trust-hub/" in brief


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

    monkeypatch.setenv("BRIGHTDATA_DEMO_SOURCE_URL", source_url)
    from app.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setattr("app.services.brightdata_client.httpx.post", fake_post)
    scan_id = _start_live_scan(live_client)

    terminal = _poll_until_terminal(live_client, scan_id)
    alerts = live_client.get(f"/api/alerts?company_id=vendor-cloudflare-demo&scan_id={scan_id}").json()
    traces = live_client.get(f"/api/brightdata/traces?scan_id={scan_id}").json()

    assert terminal["metrics"]["urls_scraped"] == 0
    assert captured_zones == ["test-serp-zone"] * 3
    assert not any(trace["source_mode"] == "live" and trace["product"] == "web_unlocker" for trace in traces)
    assert not any(alert["title"] == "Live compliance posture captured for renewal review" for alert in alerts)


def test_blocked_configured_source_is_not_requested_or_scored(monkeypatch, live_client):
    captured_zones: list[str] = []
    source_url = "https://www.cloudflare.com/trust-hub/"
    allowed_sources = [
        source_url,
        "https://developers.cloudflare.com/data-localization/",
        "https://www.cloudflarestatus.com/",
    ]

    def fake_post(url, *, headers, json, timeout):
        captured_zones.append(json["zone"])
        return httpx.Response(200, request=httpx.Request("POST", url), json={"organic": []})

    rules = live_client.patch(
        "/api/companies/vendor-cloudflare-demo/source-rules",
        json={"allow_list": allowed_sources, "block_list": [source_url]},
    )
    assert rules.status_code == 200
    monkeypatch.setattr("app.services.brightdata_client.httpx.post", fake_post)
    scan_id = _start_live_scan(live_client)

    terminal = _poll_until_terminal(live_client, scan_id)
    alerts = live_client.get(f"/api/alerts?company_id=vendor-cloudflare-demo&scan_id={scan_id}").json()
    traces = live_client.get(f"/api/brightdata/traces?scan_id={scan_id}").json()
    evidence = live_client.get(f"/api/companies/vendor-cloudflare-demo/evidence?scan_id={scan_id}").json()

    assert terminal["metrics"]["urls_scraped"] == 0
    assert terminal["metrics"]["source_count"] == 2
    assert terminal["metrics"]["evidence_count"] == 2
    assert terminal["metrics"]["verified_count"] == 2
    assert captured_zones == ["test-serp-zone"] * 3
    assert not any(trace["source_mode"] == "live" and trace["product"] == "web_unlocker" for trace in traces)
    assert not any(trace["source_url"] == source_url for trace in traces)
    assert not any(item["source_url"] == source_url for item in evidence)
    assert not any(alert["title"] == "Live compliance posture captured for renewal review" for alert in alerts)
    assert not any(alert["alert_type"] == "related_change" for alert in alerts)


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
