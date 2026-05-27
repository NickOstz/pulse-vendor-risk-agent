from datetime import datetime
from math import exp

from app.models import Alert, Company, EvidenceItem, Scan, utc_now
from app.services.serializers import dump_json


BASE_SEVERITY = {"low": 0.3, "medium": 0.6, "high": 0.9}
SOURCE_RELIABILITY = {"vendor_owned": 0.9}
VENDOR_CRITICALITY = {"normal": 0.8, "important": 1.0, "critical": 1.2}


def calculate_signal_score(
    evidence: EvidenceItem, company: Company, captured_at: datetime | None = None
) -> tuple[int, dict[str, float | str]]:
    if evidence.support_status != "verified":
        return 0, {}

    now = captured_at or utc_now()
    age_days = max(0, (now.date() - evidence.published_or_captured_at.date()).days)
    factors: dict[str, float | str] = {
        "base_severity": BASE_SEVERITY[evidence.severity_hint],
        "source_reliability": SOURCE_RELIABILITY.get(evidence.source_type, 0.5),
        "confidence": min(evidence.confidence, 0.95),
        "freshness": round(exp(-0.1 * age_days), 4),
        "vendor_criticality": VENDOR_CRITICALITY[company.criticality],
        "formula": "min(100, round(base_severity * source_reliability * confidence * freshness * vendor_criticality * 100))",
    }
    product = 1.0
    for key in ("base_severity", "source_reliability", "confidence", "freshness", "vendor_criticality"):
        product *= float(factors[key])
    return min(100, round(product * 100)), factors


def build_live_compliance_alert(
    company: Company, scan: Scan, evidence: EvidenceItem, change_status: str | None = None
) -> Alert | None:
    score, factors = calculate_signal_score(evidence, company)
    if not score:
        return None
    if change_status:
        factors["change_status"] = change_status
    return Alert(
        company_id=company.id,
        scan_id=scan.id,
        evidence_item_id=evidence.id,
        alert_type="signal",
        title="Live compliance posture captured for renewal review",
        summary="Live Cloudflare Trust Hub evidence lists SOC 2 Type II and ISO 27001 among its compliance resources.",
        score=score,
        severity=evidence.severity_hint,
        owner="Security",
        recommended_action=evidence.recommended_action,
        related_evidence_ids_json=dump_json([evidence.id]),
        score_factors_json=dump_json(factors),
        created_at=utc_now(),
    )


def build_live_signal_alert(
    company: Company, scan: Scan, evidence: EvidenceItem, change_status: str | None = None
) -> Alert | None:
    score, factors = calculate_signal_score(evidence, company)
    if not score:
        return None
    if change_status:
        factors["change_status"] = change_status
    signal_label = evidence.signal_type.replace("_", " ")
    title_action = "change requires review" if change_status == "changed" else "signal requires review"
    return Alert(
        company_id=company.id,
        scan_id=scan.id,
        evidence_item_id=evidence.id,
        alert_type="signal",
        title=f"Verified live {signal_label} {title_action}",
        summary=f"Live public-source evidence for {company.name}: {evidence.claim}",
        score=score,
        severity=evidence.severity_hint,
        owner=company.owner,
        recommended_action=evidence.recommended_action,
        related_evidence_ids_json=dump_json([evidence.id]),
        score_factors_json=dump_json(factors),
        created_at=utc_now(),
    )


def build_mixed_related_change_alert(
    company: Company, scan: Scan, live_evidence: EvidenceItem, pricing_evidence: EvidenceItem
) -> Alert:
    live_score, _ = calculate_signal_score(live_evidence, company)
    score = min(100, live_score + 10)
    return Alert(
        company_id=company.id,
        scan_id=scan.id,
        alert_type="related_change",
        title="Renewal checkpoint: live compliance and data residency scope",
        summary="A live Cloudflare compliance source and verified fallback documentation identify renewal-relevant assurance and data localization considerations.",
        score=score,
        severity="high",
        owner="Security",
        recommended_action="Review live compliance posture and regulated-data localization scope with Procurement.",
        related_evidence_ids_json=dump_json([live_evidence.id, pricing_evidence.id]),
        score_factors_json=dump_json(
            {
                "rule": "same_vendor_same_review_window_two_or_more_verified_compatible_signals",
                "live_verified_evidence": 1,
                "fallback_verified_evidence": 1,
            }
        ),
        created_at=utc_now(),
    )


def build_related_live_signal_alert(
    company: Company, scan: Scan, evidence_items: list[EvidenceItem]
) -> Alert | None:
    verified = [item for item in evidence_items if item.support_status == "verified"]
    categories = {item.signal_type for item in verified}
    if len(categories) < 2:
        return None
    scored = [(item, calculate_signal_score(item, company)[0]) for item in verified]
    strongest_score = max(score for _, score in scored)
    score = min(100, strongest_score + 10 * (len(categories) - 1))
    signals = ", ".join(sorted(category.replace("_", " ") for category in categories))
    return Alert(
        company_id=company.id,
        scan_id=scan.id,
        alert_type="related_change",
        title="Multiple verified live risk indicators require coordinated review",
        summary=f"Pulse verified live {signals} evidence for {company.name} in the same autonomous review cycle.",
        score=score,
        severity="high" if score >= 60 else "medium",
        owner=company.owner,
        recommended_action="Review the related verified findings together before the next vendor decision.",
        related_evidence_ids_json=dump_json([item.id for item in verified]),
        score_factors_json=dump_json(
            {
                "rule": "same_vendor_same_review_window_two_or_more_verified_signal_categories",
                "verified_categories": len(categories),
                "strongest_signal_score": strongest_score,
            }
        ),
        created_at=utc_now(),
    )
