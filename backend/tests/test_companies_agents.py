from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select

from app.models import Alert, Brief, BrightDataTrace, Company, EvidenceItem, Scan, utc_now
from app.services.replay_loader import seed_companies


def test_seeded_companies_and_create_company(client):
    response = client.get("/api/companies")

    assert response.status_code == 200
    companies = response.json()
    assert len(companies) == 5
    assert [company["name"] for company in companies] == [
        "Cloudflare",
        "Paddle",
        "AWS",
        "Vercel",
        "Snowflake",
    ]

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


def test_delete_company_removes_vendor_and_review_records(client):
    created = client.post(
        "/api/companies",
        json={
            "name": "DeleteMe",
            "domain": "deleteme.example",
            "relationship_type": "test vendor",
            "owner": "IT",
            "criticality": "normal",
            "renewal_date": "2026-10-10",
            "allow_list": [],
            "block_list": [],
        },
    )
    assert created.status_code == 201
    company_id = created.json()["id"]

    import app.db as db

    with Session(db.engine) as session:
        scan = Scan(company_id=company_id, status="completed", mode="live", current_stage="brief")
        session.add(scan)
        session.flush()
        evidence = EvidenceItem(
            scan_id=scan.id,
            company_id=company_id,
            signal_type="trust_security",
            claim="Verified test evidence.",
            supporting_quote="Verified quote.",
            source_url="https://deleteme.example/security",
            source_type="vendor_owned",
            published_or_captured_at=utc_now(),
            severity_hint="medium",
            confidence=0.9,
            recommended_action="Review test evidence.",
            support_status="verified",
        )
        session.add(evidence)
        session.flush()
        session.add(
            Alert(
                company_id=company_id,
                scan_id=scan.id,
                evidence_item_id=evidence.id,
                title="Delete test alert",
                summary="Delete test summary.",
                score=10,
                severity="medium",
                owner="IT",
                recommended_action="Review.",
            )
        )
        session.add(
            BrightDataTrace(
                scan_id=scan.id,
                company_id=company_id,
                product="web_unlocker",
                operation="capture_text:trust_security:configured",
                source_url="https://deleteme.example/security",
                status="success",
                source_mode="live",
            )
        )
        session.add(Brief(company_id=company_id, scan_id=scan.id, markdown="# Brief", html="<h1>Brief</h1>"))
        session.commit()

    response = client.delete(f"/api/companies/{company_id}")

    assert response.status_code == 204
    assert all(company["id"] != company_id for company in client.get("/api/companies").json())
    with Session(db.engine) as session:
        assert session.get(Company, company_id) is None
        assert session.exec(select(Scan).where(Scan.company_id == company_id)).all() == []
        assert session.exec(select(EvidenceItem).where(EvidenceItem.company_id == company_id)).all() == []
        assert session.exec(select(Alert).where(Alert.company_id == company_id)).all() == []
        assert session.exec(select(BrightDataTrace).where(BrightDataTrace.company_id == company_id)).all() == []
        assert session.exec(select(Brief).where(Brief.company_id == company_id)).all() == []


def test_seed_does_not_duplicate_a_manually_added_matching_domain(client):
    assert client.delete("/api/companies/vendor-vercel").status_code == 204
    created = client.post(
        "/api/companies",
        json={
            "name": "Vercel Custom",
            "domain": "vercel.com",
            "relationship_type": "hosting",
            "owner": "Platform",
            "criticality": "important",
            "renewal_date": "2026-09-20",
            "allow_list": ["https://vercel.com/security"],
            "block_list": [],
        },
    )
    assert created.status_code == 201

    import app.db as db

    with Session(db.engine) as session:
        seed_companies(session)

    vercel_rows = [
        company for company in client.get("/api/companies").json() if company["domain"] == "vercel.com"
    ]
    assert len(vercel_rows) == 1
    assert vercel_rows[0]["id"] == created.json()["id"]
    assert vercel_rows[0]["name"] == "Vercel Custom"


def test_enable_agent_makes_vendor_due_now_on_daily_policy(client):
    company = next(item for item in client.get("/api/companies").json() if item["id"] == "vendor-cloudflare-demo")

    response = client.patch(f"/api/companies/{company['id']}/agent", json={"agent_enabled": True})

    assert response.status_code == 200
    body = response.json()
    assert body["agent_enabled"] is True
    assert body["agent_status"] == "active"
    assert body["review_policy"] == "daily"
    assert datetime.fromisoformat(body["next_agent_run_at"]) <= datetime.now(timezone.utc)

    status = client.get("/api/agents/status").json()
    assert [vendor["id"] for vendor in status["due_vendors"]] == ["vendor-cloudflare-demo"]


def test_enable_normal_vendor_runs_now_on_daily_policy(client):
    response = client.patch("/api/companies/vendor-snowflake/agent", json={"agent_enabled": True})

    assert response.status_code == 200
    body = response.json()
    assert body["review_policy"] == "daily"
    assert datetime.fromisoformat(body["next_agent_run_at"]) <= datetime.now(timezone.utc)

    status = client.get("/api/agents/status").json()
    assert [vendor["id"] for vendor in status["due_vendors"]] == ["vendor-snowflake"]


def test_enable_watchlist_assigns_policy_to_each_vendor(client):
    response = client.patch("/api/agents/watchlist", json={"agent_enabled": True})

    assert response.status_code == 200
    companies = {company["id"]: company for company in response.json()}
    assert len(companies) == 5
    assert all(company["agent_enabled"] for company in companies.values())
    assert all(company["review_policy"] == "daily" for company in companies.values())

    status = client.get("/api/agents/status").json()
    assert {vendor["id"] for vendor in status["due_vendors"]} == set(companies)

    disabled = client.patch("/api/agents/watchlist", json={"agent_enabled": False})
    assert disabled.status_code == 200
    assert all(not company["agent_enabled"] for company in disabled.json())
    assert all(company["review_policy"] is None for company in disabled.json())


def test_update_review_policy_reschedules_enabled_vendor(client):
    enabled = client.patch("/api/companies/vendor-snowflake/agent", json={"agent_enabled": True})
    assert enabled.status_code == 200

    response = client.patch(
        "/api/companies/vendor-snowflake/review-policy",
        json={"review_policy": "weekly"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["review_policy"] == "weekly"
    assert datetime.fromisoformat(body["next_agent_run_at"]) <= datetime.now(timezone.utc)


def test_completed_review_uses_selected_review_policy(client):
    import app.db as db
    from app.services.serializers import next_review_after_run

    with Session(db.engine) as session:
        company = session.get(Company, "vendor-aws")
        assert company is not None
        completed_at = utc_now()
        company.agent_enabled = True
        company.review_policy = "weekly"

        assert next_review_after_run(company, completed_at) == completed_at + timedelta(weeks=1)
        assert company.review_policy == "weekly"


def test_seed_preserves_valid_enabled_review_policy(client):
    import app.db as db

    with Session(db.engine) as session:
        company = session.get(Company, "vendor-aws")
        assert company is not None
        last_run = utc_now() - timedelta(days=2)
        company.agent_enabled = True
        company.review_policy = "weekly"
        company.last_agent_run_at = last_run
        company.next_agent_run_at = last_run + timedelta(days=7)
        session.add(company)
        session.commit()
        seed_companies(session)
        session.refresh(company)

        assert company.review_policy == "weekly"
        assert company.next_agent_run_at is not None
        assert company.next_agent_run_at.replace(tzinfo=timezone.utc) == last_run + timedelta(days=7)
