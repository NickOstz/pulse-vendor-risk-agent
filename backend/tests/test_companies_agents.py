from datetime import datetime, timezone


def test_seeded_companies_and_create_company(client):
    response = client.get("/api/companies")

    assert response.status_code == 200
    companies = response.json()
    assert len(companies) == 5
    assert companies[0]["name"] == "Cloudflare"

    create_response = client.post(
        "/api/companies",
        json={
            "name": "SecureForms",
            "domain": "secureforms.example",
            "relationship_type": "documents",
            "owner": "Legal",
            "criticality": "normal",
            "renewal_date": "2026-10-10",
            "allow_list": [" https://secureforms.example/trust ", "https://secureforms.example/trust"],
            "block_list": ["", "https://secureforms.example/careers"],
        },
    )

    assert create_response.status_code == 201
    assert create_response.json()["agent_status"] == "inactive"
    assert create_response.json()["allow_list"] == ["https://secureforms.example/trust"]
    assert create_response.json()["block_list"] == ["https://secureforms.example/careers"]


def test_update_source_rules_persists_normalized_vendor_rules(client):
    company_id = "vendor-cloudflare-demo"

    response = client.patch(
        f"/api/companies/{company_id}/source-rules",
        json={
            "allow_list": [" https://www.cloudflare.com/trust-hub/ ", "https://www.cloudflare.com/trust-hub/"],
            "block_list": ["https://www.cloudflarestatus.com/", ""],
        },
    )

    assert response.status_code == 200
    assert response.json()["allow_list"] == ["https://www.cloudflare.com/trust-hub/"]
    assert response.json()["block_list"] == ["https://www.cloudflarestatus.com/"]
    stored = next(item for item in client.get("/api/companies").json() if item["id"] == company_id)
    assert stored["allow_list"] == ["https://www.cloudflare.com/trust-hub/"]
    assert stored["block_list"] == ["https://www.cloudflarestatus.com/"]


def test_enable_agent_makes_demo_vendor_due_now(client):
    company = next(item for item in client.get("/api/companies").json() if item["id"] == "vendor-cloudflare-demo")

    response = client.patch(f"/api/companies/{company['id']}/agent", json={"agent_enabled": True})

    assert response.status_code == 200
    body = response.json()
    assert body["agent_enabled"] is True
    assert body["agent_status"] == "active"
    assert body["review_policy"] == "critical_renewal_due"
    assert datetime.fromisoformat(body["next_agent_run_at"]) <= datetime.now(timezone.utc)

    status = client.get("/api/agents/status").json()
    assert [vendor["id"] for vendor in status["due_vendors"]] == ["vendor-cloudflare-demo"]


def test_enable_watchlist_assigns_policy_to_each_vendor(client):
    response = client.patch("/api/agents/watchlist", json={"agent_enabled": True})

    assert response.status_code == 200
    companies = {company["id"]: company for company in response.json()}
    assert len(companies) == 5
    assert all(company["agent_enabled"] for company in companies.values())
    assert companies["vendor-cloudflare-demo"]["review_policy"] == "critical_renewal_due"
    assert companies["vendor-auth0"]["review_policy"] == "weekly"
    assert companies["vendor-stripe"]["review_policy"] == "weekly"
    assert companies["vendor-datadog"]["review_policy"] == "manual_low_frequency"
    assert companies["vendor-snowflake"]["review_policy"] == "manual_low_frequency"

    status = client.get("/api/agents/status").json()
    assert [vendor["id"] for vendor in status["due_vendors"]] == ["vendor-cloudflare-demo"]

    disabled = client.patch("/api/agents/watchlist", json={"agent_enabled": False})
    assert disabled.status_code == 200
    assert all(not company["agent_enabled"] for company in disabled.json())
    assert all(company["review_policy"] is None for company in disabled.json())
