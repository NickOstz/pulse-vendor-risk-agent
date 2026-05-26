from app.config import get_settings
from app.models import Company, EvidenceItem, Scan, utc_now
from app.services.extraction import DeepSeekExtractionClient, ExtractedEvidence, evidence_from_extraction, extract_source


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
    if settings.llm_extraction_enabled and settings.deepseek_api_key:
        return extract_source(
            company=company,
            scan=scan,
            source_text=content,
            source_url=source_url,
            source_type="vendor_owned",
            snapshot_path=snapshot_path,
            signal_type="trust_security",
            client=DeepSeekExtractionClient(
                api_key=settings.deepseek_api_key,
                endpoint=settings.deepseek_api_endpoint,
                model=settings.deepseek_extraction_model,
                timeout_seconds=settings.llm_extraction_timeout_seconds,
            ),
        )

    candidate = ExtractedEvidence.model_validate(
        {
            "vendor_id": company.id,
            "signal_type": "trust_security",
            "claim": "Cloudflare publicly identifies SOC 2 Type II and ISO 27001 among its compliance resources.",
            "supporting_quote": CLOUDFLARE_COMPLIANCE_QUOTE,
            "source_url": source_url,
            "source_type": "vendor_owned",
            "published_or_captured_at": utc_now(),
            "severity_hint": "medium",
            "confidence": 0.95,
            "recommended_action": "Request the current in-scope compliance package for the renewal record.",
        }
    )
    return evidence_from_extraction(
        company=company,
        scan=scan,
        candidate=candidate,
        source_text=content,
        snapshot_path=snapshot_path,
    )
