def _run_demo_scan(client) -> tuple[str, str]:
    company_id = "vendor-cloudflare-demo"
    client.patch(f"/api/companies/{company_id}/agent", json={"agent_enabled": True})
    tick = client.post("/api/agents/tick")
    assert tick.status_code == 200
    return company_id, tick.json()["started_scan_ids"][0]


def _poll_until_complete(client, scan_id: str) -> None:
    for _ in range(8):
        response = client.get(f"/api/scans/{scan_id}")
        assert response.status_code == 200
        if response.json()["status"] == "completed":
            return
    raise AssertionError("scan did not complete")


def _first_alert(client, company_id: str, scan_id: str) -> dict:
    response = client.get(f"/api/alerts?company_id={company_id}&scan_id={scan_id}")
    assert response.status_code == 200
    return response.json()[0]


def test_alert_review_status_can_be_updated_to_allowed_statuses(client):
    company_id, scan_id = _run_demo_scan(client)
    _poll_until_complete(client, scan_id)
    alert = _first_alert(client, company_id, scan_id)

    for status in ["approved", "dismissed", "needs_review"]:
        response = client.patch(f"/api/alerts/{alert['id']}", json={"status": status})

        assert response.status_code == 200
        assert response.json()["status"] == status

    refreshed = client.get(f"/api/alerts?company_id={company_id}&scan_id={scan_id}")
    assert refreshed.status_code == 200
    assert refreshed.json()[0]["status"] == "needs_review"


def test_alert_review_status_rejects_contract_gaps(client):
    company_id, scan_id = _run_demo_scan(client)
    _poll_until_complete(client, scan_id)
    alert = _first_alert(client, company_id, scan_id)

    response = client.patch(f"/api/alerts/{alert['id']}", json={"status": "new"})

    assert response.status_code == 422
    refreshed = client.get(f"/api/alerts?company_id={company_id}&scan_id={scan_id}")
    assert refreshed.status_code == 200
    assert refreshed.json()[0]["status"] == "new"
