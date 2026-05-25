def _run_demo_scan(client) -> tuple[str, str]:
    company_id = "vendor-cloudflare-demo"
    client.patch(f"/api/companies/{company_id}/agent", json={"agent_enabled": True})
    tick = client.post("/api/agents/tick")
    assert tick.status_code == 200
    scan_id = tick.json()["started_scan_ids"][0]
    return company_id, scan_id


def _poll_until_complete(client, scan_id: str) -> dict:
    body = {}
    for _ in range(8):
        response = client.get(f"/api/scans/{scan_id}")
        assert response.status_code == 200
        body = response.json()
        if body["status"] == "completed":
            return body
    raise AssertionError("scan did not complete")


def test_tick_creates_observable_running_replay_scan_then_completes(client):
    company_id, scan_id = _run_demo_scan(client)

    scan = client.get(f"/api/scans/{scan_id}")

    assert scan.status_code == 200
    body = scan.json()
    assert body["company_id"] == company_id
    assert body["status"] == "running"
    assert body["mode"] == "replay"
    assert body["current_stage"] == "collect"
    assert body["stages"][0] == {"name": "collect", "status": "running"}

    active = client.get("/api/agents/status").json()
    assert active["active_runs"] == [{"company_id": company_id, "scan_id": scan_id, "current_stage": "extract"}]

    body = _poll_until_complete(client, scan_id)
    assert body["status"] == "completed"
    assert [stage["name"] for stage in body["stages"]] == ["collect", "extract", "verify", "score", "brief"]
    assert {stage["status"] for stage in body["stages"]} == {"completed"}
    assert body["metrics"]["evidence_count"] == 3
    assert body["metrics"]["verified_count"] == 3


def test_replay_alert_evidence_trace_and_brief_contract(client):
    company_id, scan_id = _run_demo_scan(client)
    _poll_until_complete(client, scan_id)

    alerts = client.get(f"/api/alerts?company_id={company_id}&scan_id={scan_id}")
    evidence = client.get(f"/api/companies/{company_id}/evidence?scan_id={scan_id}")
    traces = client.get(f"/api/brightdata/traces?scan_id={scan_id}")
    brief = client.post(
        "/api/briefs/vendor-review",
        json={"company_id": company_id, "scan_id": scan_id, "format": "markdown"},
    )

    assert alerts.status_code == 200
    assert evidence.status_code == 200
    assert traces.status_code == 200
    assert brief.status_code == 200

    alert_rows = alerts.json()
    evidence_rows = evidence.json()
    trace_rows = traces.json()

    assert len(alert_rows) == 3
    assert any(alert["alert_type"] == "related_change" for alert in alert_rows)
    assert all(item["support_status"] == "verified" for item in evidence_rows)
    assert all(item["quote_match_score"] >= 0.96 for item in evidence_rows)
    assert {trace["source_mode"] for trace in trace_rows} == {"cached"}
    assert "Vendor Risk Assessment Brief: Cloudflare" in brief.json()["content"]
