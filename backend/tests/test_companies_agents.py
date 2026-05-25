from datetime import datetime, timezone


def test_seeded_companies_and_create_company(client):
    response = client.get("/api/companies")

    assert response.status_code == 200
    companies = response.json()
    assert len(companies) == 5
    assert companies[0]["name"] == "DataForge"

    create_response = client.post(
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

    assert create_response.status_code == 201
    assert create_response.json()["agent_status"] == "inactive"


def test_enable_agent_makes_demo_vendor_due_now(client):
    company = next(item for item in client.get("/api/companies").json() if item["id"] == "vendor-dataforge-demo")

    response = client.patch(f"/api/companies/{company['id']}/agent", json={"agent_enabled": True})

    assert response.status_code == 200
    body = response.json()
    assert body["agent_enabled"] is True
    assert body["agent_status"] == "active"
    assert body["review_policy"] == "critical_renewal_due"
    assert datetime.fromisoformat(body["next_agent_run_at"]) <= datetime.now(timezone.utc)

    status = client.get("/api/agents/status").json()
    assert [vendor["id"] for vendor in status["due_vendors"]] == ["vendor-dataforge-demo"]
