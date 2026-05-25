from sqlmodel import Session

from app.models import BrightDataTrace, Company, Scan, utc_now
from app.services.brightdata_client import BrightDataClient


def record_live_collection_attempt(session: Session, company: Company, scan: Scan) -> None:
    """Capture one budgeted Bright Data live proof before seeded fallback data."""
    attempt = BrightDataClient().search_vendor_risk(company)
    session.add(
        BrightDataTrace(
            scan_id=scan.id,
            company_id=company.id,
            product=attempt.product,
            operation=attempt.operation,
            source_url=attempt.source_url,
            status=attempt.status,
            latency_ms=attempt.latency_ms,
            retry_count=attempt.retry_count,
            error=attempt.error,
            source_mode="live",
            created_at=utc_now(),
        )
    )
    scan.serp_queries_used = 1
    session.add(scan)
    session.commit()
