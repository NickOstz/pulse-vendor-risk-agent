import hashlib
import json
from pathlib import Path

from sqlmodel import Session

from app.config import get_settings
from app.models import BrightDataTrace, Company, Scan, utc_now
from app.services.brightdata_client import BrightDataAttempt, BrightDataClient
from app.services.serializers import dump_json


def record_live_collection_attempt(session: Session, company: Company, scan: Scan) -> None:
    """Capture bounded live discovery and optional configured page content."""
    settings = get_settings()
    client = BrightDataClient(settings)
    attempts = [client.search_vendor_risk(company)]
    scan.serp_queries_used = 1

    if settings.brightdata_demo_source_url and client.unlocker_configured:
        page_attempt = client.fetch_markdown(settings.brightdata_demo_source_url)
        attempts.append(page_attempt)
        if page_attempt.status == "success" and page_attempt.content is not None:
            _save_snapshot(scan, page_attempt.content)
            scan.urls_scraped += 1
            scan.source_count += 1

    for attempt in attempts:
        _add_trace(session, company, scan, attempt)

    session.add(scan)
    session.commit()


def _add_trace(session: Session, company: Company, scan: Scan, attempt: BrightDataAttempt) -> None:
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


def _save_snapshot(scan: Scan, content: str) -> Path:
    settings = get_settings()
    snapshot_dir = settings.live_snapshot_dir
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    snapshot_path = snapshot_dir / f"{scan.id}-configured-source.md"
    snapshot_path.write_text(content, encoding="utf-8")

    content_hash = f"sha256:{hashlib.sha256(content.encode('utf-8')).hexdigest()}"
    hashes = json.loads(scan.content_hashes_json or "[]")
    if content_hash not in hashes:
        hashes.append(content_hash)
    scan.content_hashes_json = dump_json(hashes)
    return snapshot_path
