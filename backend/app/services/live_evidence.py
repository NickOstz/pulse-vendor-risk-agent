from pydantic import BaseModel, Field

from app.config import get_settings
from app.models import Company, EvidenceItem, Scan, utc_now
from app.services.verification import verify_quote


class LiveEvidenceCandidate(BaseModel):
    signal_type: str = Field(pattern="^trust_security$")
    claim: str = Field(min_length=1)
    supporting_quote: str = Field(min_length=1)
    source_url: str = Field(min_length=1)
    source_type: str = Field(pattern="^vendor_owned$")
    severity_hint: str = Field(pattern="^medium$")
    confidence: float = Field(ge=0, le=1)
    recommended_action: str = Field(min_length=1)


CLOUDFLARE_COMPLIANCE_QUOTE = (
    "Explore our posture around ISO 27001, ISO 27701, PCI DSS, SOC 2 Type II, and others"
)
CLOUDFLARE_TRUST_HUB_URL = "https://www.cloudflare.com/trust-hub/"


def is_supported_live_source(company: Company, source_url: str) -> bool:
    return company.domain == "cloudflare.com" and source_url == CLOUDFLARE_TRUST_HUB_URL


def extract_live_cloudflare_trust_evidence(company: Company, scan: Scan) -> EvidenceItem | None:
    settings = get_settings()
    source_url = settings.brightdata_demo_source_url
    if not source_url or not is_supported_live_source(company, source_url):
        return None

    snapshot_path = settings.live_snapshot_dir / f"{scan.id}-configured-source.md"
    if not snapshot_path.exists():
        return None

    content = snapshot_path.read_text(encoding="utf-8")
    candidate = LiveEvidenceCandidate.model_validate(
        {
            "signal_type": "trust_security",
            "claim": "Cloudflare publicly identifies SOC 2 Type II and ISO 27001 among its compliance resources.",
            "supporting_quote": CLOUDFLARE_COMPLIANCE_QUOTE,
            "source_url": source_url,
            "source_type": "vendor_owned",
            "severity_hint": "medium",
            "confidence": 0.95,
            "recommended_action": "Request the current in-scope compliance package for the renewal record.",
        }
    )
    support_status, quote_match_score = verify_quote(content, candidate.supporting_quote)

    return EvidenceItem(
        scan_id=scan.id,
        company_id=company.id,
        signal_type=candidate.signal_type,
        claim=candidate.claim,
        supporting_quote=candidate.supporting_quote,
        source_url=candidate.source_url,
        source_type=candidate.source_type,
        published_or_captured_at=utc_now(),
        severity_hint=candidate.severity_hint,
        confidence=candidate.confidence,
        recommended_action=candidate.recommended_action,
        support_status=support_status,
        quote_match_score=quote_match_score,
        snapshot_path=str(snapshot_path),
        source_excerpt=_excerpt(content, candidate.supporting_quote),
        created_at=utc_now(),
    )


def _excerpt(content: str, quote: str) -> str:
    normalized_quote = quote.casefold()
    start = content.casefold().find(normalized_quote)
    if start < 0:
        return content[:240].replace("\n", " ")
    excerpt_start = max(0, start - 48)
    excerpt_end = min(len(content), start + len(quote) + 48)
    return content[excerpt_start:excerpt_end].replace("\n", " ")
