from datetime import UTC, datetime

from app.models import BrightDataTrace, Company, EvidenceItem
from app.services.brief_renderer import render_vendor_review_brief
from app.services.scoring import calculate_signal_score
from app.services.verification import verify_quote


def test_quote_verification_accepts_exact_and_supported_fuzzy_matches() -> None:
    exact = verify_quote("Controls include SOC 2 Type II compliance.", "SOC 2 Type II compliance.")
    fuzzy = verify_quote("Controls include SOC 2 Type II compliance.", "SOC2 Type II compliance")

    assert exact == ("verified", 1.0)
    assert fuzzy[0] == "verified"
    assert fuzzy[1] >= 0.8


def test_quote_verification_rejects_unsupported_claim() -> None:
    status, score = verify_quote("This page lists privacy documentation.", "SOC 2 Type II certification.")

    assert status == "needs_review"
    assert score < 0.8


def test_verified_live_signal_score_is_deterministic_and_confidence_capped() -> None:
    captured_at = datetime(2026, 5, 26, tzinfo=UTC)
    company = Company(
        name="Cloudflare",
        domain="cloudflare.com",
        relationship_type="edge security",
        owner="Security",
        criticality="critical",
        renewal_date=captured_at.date(),
    )
    evidence = EvidenceItem(
        scan_id="scan",
        company_id="vendor",
        signal_type="trust_security",
        claim="Cloudflare lists SOC 2 Type II.",
        supporting_quote="SOC 2 Type II",
        source_url="https://www.cloudflare.com/trust-hub/",
        source_type="vendor_owned",
        published_or_captured_at=captured_at,
        severity_hint="medium",
        confidence=0.99,
        recommended_action="Review.",
        support_status="verified",
    )

    score, factors = calculate_signal_score(evidence, company, captured_at=captured_at)

    assert score == 62
    assert factors["confidence"] == 0.95


def test_brief_renderer_includes_only_verified_evidence_and_source_mode() -> None:
    captured_at = datetime(2026, 5, 26, tzinfo=UTC)
    company = Company(
        id="vendor",
        name="Cloudflare",
        domain="cloudflare.com",
        relationship_type="edge security",
        owner="Security",
        criticality="critical",
        renewal_date=captured_at.date(),
    )
    verified = EvidenceItem(
        scan_id="scan",
        company_id="vendor",
        signal_type="trust_security",
        claim="Verified compliance resources are public.",
        supporting_quote="SOC 2 Type II",
        source_url="https://www.cloudflare.com/trust-hub/",
        source_type="vendor_owned",
        published_or_captured_at=captured_at,
        severity_hint="medium",
        confidence=0.95,
        recommended_action="Request compliance artifacts.",
        support_status="verified",
    )
    unsupported = EvidenceItem(
        scan_id="scan",
        company_id="vendor",
        signal_type="adverse_media",
        claim="Unsupported incident allegation.",
        supporting_quote="Not in source",
        source_url="https://www.cloudflare.com/trust-hub/",
        source_type="vendor_owned",
        published_or_captured_at=captured_at,
        severity_hint="high",
        confidence=0.4,
        recommended_action="Escalate unsupported claim.",
        support_status="needs_review",
    )
    trace = BrightDataTrace(
        scan_id="scan",
        company_id="vendor",
        product="web_unlocker",
        operation="scrape_markdown",
        source_url="https://www.cloudflare.com/trust-hub/",
        status="success",
        source_mode="live",
    )

    markdown, html = render_vendor_review_brief(company, [verified, unsupported], [trace])

    assert "Verified compliance resources are public." in markdown
    assert "Unsupported incident allegation." not in markdown
    assert "| Trust / security | medium | live | verified |" in markdown
    assert "Unsupported incident allegation." not in html
    assert "<table>" in html
