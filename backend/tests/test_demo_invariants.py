from collections.abc import Iterable


DEMO_COMPANY_ID = "vendor-dataforge-demo"
TERMINAL_STATUSES = {"completed", "completed_with_fallback"}
STAGE_NAMES = ["collect", "extract", "verify", "score", "brief"]


def _start_due_demo_scan(client) -> tuple[str, str]:
    response = client.patch(f"/api/companies/{DEMO_COMPANY_ID}/agent", json={"agent_enabled": True})
    assert response.status_code == 200

    tick = client.post("/api/agents/tick")
    assert tick.status_code == 200
    scan_ids = tick.json()["started_scan_ids"]
    assert len(scan_ids) == 1
    return DEMO_COMPANY_ID, scan_ids[0]


def _poll_scan(client, scan_id: str) -> list[dict]:
    scans = []
    for _ in range(8):
        response = client.get(f"/api/scans/{scan_id}")
        assert response.status_code == 200
        body = response.json()
        scans.append(body)
        if body["status"] in TERMINAL_STATUSES:
            return scans
    raise AssertionError("scan did not reach a terminal state")


def _completed_scan(client, scan_id: str) -> dict:
    return _poll_scan(client, scan_id)[-1]


def _by_id(rows: Iterable[dict]) -> dict[str, dict]:
    return {row["id"]: row for row in rows}


def test_full_autonomous_lifecycle_polls_all_review_stages(client):
    _, scan_id = _start_due_demo_scan(client)

    scans = _poll_scan(client, scan_id)

    assert [scan["current_stage"] for scan in scans] == [*STAGE_NAMES, "brief"]
    assert [scan["status"] for scan in scans[:-1]] == ["running"] * len(STAGE_NAMES)
    assert scans[-1]["status"] == "completed"
    assert scans[-1]["stages"] == [{"name": name, "status": "completed"} for name in STAGE_NAMES]
    assert scans[-1]["metrics"]["evidence_count"] == 3
    assert scans[-1]["metrics"]["verified_count"] == 3


def test_repeated_tick_while_scan_is_running_does_not_start_duplicate(client):
    _, scan_id = _start_due_demo_scan(client)

    second_tick = client.post("/api/agents/tick")
    active = client.get("/api/agents/status")

    assert second_tick.status_code == 200
    assert second_tick.json()["started_scan_ids"] == []
    assert active.status_code == 200
    assert active.json()["active_runs"] == [
        {"company_id": DEMO_COMPANY_ID, "scan_id": scan_id, "current_stage": "collect"}
    ]


def test_manual_recovery_scan_stays_replay_only_with_cached_trace_labels(client):
    response = client.post("/api/scans/run", json={"company_id": DEMO_COMPANY_ID})
    assert response.status_code == 200
    scan_id = response.json()["id"]

    completed = _completed_scan(client, scan_id)
    traces = client.get(f"/api/brightdata/traces?scan_id={scan_id}")

    assert completed["status"] == "completed"
    assert completed["mode"] == "replay"
    assert traces.status_code == 200
    assert traces.json()
    assert {trace["source_mode"] for trace in traces.json()} == {"cached"}
    assert {trace["status"] for trace in traces.json()} == {"cached"}


def test_high_priority_signal_alerts_reference_verified_evidence(client):
    _, scan_id = _start_due_demo_scan(client)
    _completed_scan(client, scan_id)

    alerts = client.get(f"/api/alerts?company_id={DEMO_COMPANY_ID}&scan_id={scan_id}").json()
    evidence = _by_id(client.get(f"/api/companies/{DEMO_COMPANY_ID}/evidence?scan_id={scan_id}").json())
    high_priority_signals = [
        alert for alert in alerts if alert["alert_type"] == "signal" and alert["severity"] == "high"
    ]

    assert high_priority_signals
    for alert in high_priority_signals:
        evidence_item = evidence.get(alert["evidence_item_id"])
        assert evidence_item is not None
        assert evidence_item["scan_id"] == scan_id
        assert evidence_item["support_status"] == "verified"


def test_related_change_evidence_ids_resolve_to_verified_evidence_in_same_scan(client):
    _, scan_id = _start_due_demo_scan(client)
    _completed_scan(client, scan_id)

    alerts = client.get(f"/api/alerts?company_id={DEMO_COMPANY_ID}&scan_id={scan_id}").json()
    evidence = _by_id(client.get(f"/api/companies/{DEMO_COMPANY_ID}/evidence?scan_id={scan_id}").json())
    related_changes = [alert for alert in alerts if alert["alert_type"] == "related_change"]

    assert related_changes
    for alert in related_changes:
        assert len(alert["related_evidence_ids"]) >= 2
        for evidence_id in alert["related_evidence_ids"]:
            evidence_item = evidence.get(evidence_id)
            assert evidence_item is not None
            assert evidence_item["scan_id"] == scan_id
            assert evidence_item["support_status"] == "verified"


def test_completed_demo_scan_returns_markdown_and_html_briefs(client):
    _, scan_id = _start_due_demo_scan(client)
    _completed_scan(client, scan_id)

    markdown = client.post(
        "/api/briefs/vendor-review",
        json={"company_id": DEMO_COMPANY_ID, "scan_id": scan_id, "format": "markdown"},
    )
    html = client.post(
        "/api/briefs/vendor-review",
        json={"company_id": DEMO_COMPANY_ID, "scan_id": scan_id, "format": "html"},
    )

    assert markdown.status_code == 200
    assert markdown.json()["format"] == "markdown"
    assert "Vendor Risk Assessment Brief: DataForge" in markdown.json()["content"]
    assert html.status_code == 200
    assert html.json()["format"] == "html"
    assert "<h1>Vendor Risk Assessment Brief: DataForge</h1>" in html.json()["content"]
