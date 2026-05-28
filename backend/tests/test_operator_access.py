OPERATOR_HEADERS = {"X-Pulse-Operator-Token": "test-operator-token"}


def test_operator_token_can_be_verified_without_mutating_state(protected_client):
    missing = protected_client.get("/api/operator-access")
    wrong = protected_client.get(
        "/api/operator-access", headers={"X-Pulse-Operator-Token": "wrong"}
    )
    authorized = protected_client.get("/api/operator-access", headers=OPERATOR_HEADERS)

    assert missing.status_code == 401
    assert wrong.status_code == 401
    assert authorized.status_code == 200
    assert authorized.json() == {"write_protection_enabled": True}
    assert protected_client.get("/api/companies").json()[0]["agent_enabled"] is False


def test_operator_token_protects_agent_actions_and_manual_scan(protected_client):
    enable_url = "/api/companies/vendor-cloudflare-demo/agent"

    blocked_enable = protected_client.patch(enable_url, json={"agent_enabled": True})
    blocked_tick = protected_client.post("/api/agents/tick")
    blocked_manual = protected_client.post(
        "/api/scans/run", json={"company_id": "vendor-cloudflare-demo"}
    )

    assert blocked_enable.status_code == 401
    assert blocked_tick.status_code == 401
    assert blocked_manual.status_code == 401
    assert protected_client.get("/api/companies").json()[0]["agent_enabled"] is False

    enabled = protected_client.patch(
        enable_url, json={"agent_enabled": True}, headers=OPERATOR_HEADERS
    )
    tick = protected_client.post("/api/agents/tick", headers=OPERATOR_HEADERS)

    assert enabled.status_code == 200
    assert tick.status_code == 200
    assert tick.json()["started_scan_ids"]


def test_public_poll_reads_but_cannot_advance_protected_running_scan(protected_client):
    protected_client.patch(
        "/api/companies/vendor-cloudflare-demo/agent",
        json={"agent_enabled": True},
        headers=OPERATOR_HEADERS,
    )
    started = protected_client.post("/api/agents/tick", headers=OPERATOR_HEADERS)
    scan_id = started.json()["started_scan_ids"][0]

    public_first = protected_client.get(f"/api/scans/{scan_id}")
    public_second = protected_client.get(f"/api/scans/{scan_id}")
    still_collecting = protected_client.get("/api/agents/status")

    assert public_first.status_code == 200
    assert public_second.status_code == 200
    assert public_first.json()["current_stage"] == "collect"
    assert public_second.json()["current_stage"] == "collect"
    assert still_collecting.json()["active_runs"][0]["current_stage"] == "collect"

    authorized_poll = protected_client.get(f"/api/scans/{scan_id}", headers=OPERATOR_HEADERS)
    advanced_status = protected_client.get("/api/agents/status")

    assert authorized_poll.status_code == 200
    assert advanced_status.json()["active_runs"][0]["current_stage"] == "extract"


def test_operator_token_protects_watchlist_and_vendor_configuration(protected_client):
    blocked_create = protected_client.post(
        "/api/companies",
        json={
            "name": "SecureForms",
            "domain": "secureforms.example",
            "relationship_type": "documents",
            "owner": "Legal",
            "criticality": "normal",
            "renewal_date": "2026-10-10",
        },
    )
    blocked_rules = protected_client.patch(
        "/api/companies/vendor-cloudflare-demo/source-rules",
        json={"allow_list": [], "block_list": []},
    )
    blocked_watchlist = protected_client.patch(
        "/api/agents/watchlist", json={"agent_enabled": True}
    )

    assert blocked_create.status_code == 401
    assert blocked_rules.status_code == 401
    assert blocked_watchlist.status_code == 401

    created = protected_client.post(
        "/api/companies",
        json={
            "name": "SecureForms",
            "domain": "secureforms.example",
            "relationship_type": "documents",
            "owner": "Legal",
            "criticality": "normal",
            "renewal_date": "2026-10-10",
        },
        headers=OPERATOR_HEADERS,
    )

    assert created.status_code == 201


def test_operator_token_protects_alert_review_mutations(protected_client):
    blocked = protected_client.patch("/api/alerts/not-found", json={"status": "approved"})
    authorized = protected_client.patch(
        "/api/alerts/not-found",
        json={"status": "approved"},
        headers=OPERATOR_HEADERS,
    )

    assert blocked.status_code == 401
    assert authorized.status_code == 404
