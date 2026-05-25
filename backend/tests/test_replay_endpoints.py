def _run_demo_scan(client) -> tuple[str, str]:
    company_id = "vendor-dataforge-demo"
    client.patch(f"/api/companies/{company_id}/agent", json={"agent_enabled": True})
    tick = client.post("/api/agents/tick")
    assert tick.status_code == 200
    scan_id = tick.json()["started_scan_ids"][0]
    return company_id, scan_id


def test_tick_creates_completed_replay_scan_with_stages(client):
    company_id, scan_id = _run_demo_scan(client)

    scan = client.get(f"/api/scans/{scan_id}")

    assert scan.status_code == 200
    body = scan.json()
    assert body["company_id"] == company_id
    assert body["status"] == "completed"
    assert body["mode"] == "replay"
    assert [stage["name"] for stage in body["stages"]] == ["collect", "extract", "verify", "score", "brief"]
    assert {stage["status"] for stage in body["stages"]} == {"completed"}
    assert body["metrics"]["evidence_count"] == 3
    assert body["metrics"]["verified_count"] == 3


def test_replay_alert_evidence_trace_and_brief_contract(client):
    company_id, scan_id = _run_demo_scan(client)

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
    assert "Vendor Risk Assessment Brief: DataForge" in brief.json()["content"]
