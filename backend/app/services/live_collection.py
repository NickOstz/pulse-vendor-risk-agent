import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

from sqlmodel import Session

from app.config import get_settings
from app.models import BrightDataTrace, Company, Scan, utc_now
from app.services.brightdata_client import BrightDataAttempt, BrightDataClient
from app.services.live_evidence import configured_live_source_url
from app.services.serializers import dump_json, parse_json_list

MAX_SERP_QUERIES_PER_REVIEW = 6
MAX_URLS_PER_REVIEW = 12
QUERY_TEMPLATES = {
    "trust_security": "{name} {domain} trust security privacy compliance SOC 2",
    "pricing_terms": "{name} {domain} pricing terms packaging renewal",
    "adverse_media": "{name} {domain} breach incident outage lawsuit regulatory enforcement",
}


@dataclass(frozen=True)
class InvestigationTarget:
    source_url: str
    signal_type: str
    source_type: str
    origin: str


def record_live_collection_attempt(session: Session, company: Company, scan: Scan) -> None:
    """Run a bounded source investigation driven by SERP discoveries."""
    client = BrightDataClient(get_settings())
    attempts: list[BrightDataAttempt] = []
    targets: list[InvestigationTarget] = []
    configured_url = configured_live_source_url(company)
    if configured_url:
        targets.append(InvestigationTarget(configured_url, "trust_security", "vendor_owned", "configured"))

    for signal_type, query_template in QUERY_TEMPLATES.items():
        if scan.serp_queries_used >= MAX_SERP_QUERIES_PER_REVIEW:
            break
        query = query_template.format(name=company.name, domain=company.domain)
        search_attempt = client.search_vendor_risk(company, signal_type=signal_type, query=query)
        attempts.append(search_attempt)
        scan.serp_queries_used += 1
        if search_attempt.status == "success" and search_attempt.content:
            targets.extend(_targets_from_serp(company, signal_type, search_attempt.content))

    targets = _dedupe_targets(targets)[:MAX_URLS_PER_REVIEW]
    if client.unlocker_configured:
        for target in targets:
            if scan.urls_scraped >= MAX_URLS_PER_REVIEW:
                break
            page_attempt = client.fetch_source_text(
                target.source_url,
                signal_type=target.signal_type,
                origin=target.origin,
            )
            attempts.append(page_attempt)
            if page_attempt.status == "success" and page_attempt.content is not None:
                save_snapshot(scan, target, page_attempt.content)
                scan.urls_scraped += 1
                scan.source_count += 1

    for attempt in attempts:
        _add_trace(session, company, scan, attempt)
    session.add(scan)
    session.commit()


def save_snapshot(scan: Scan, target: InvestigationTarget, content: str) -> Path:
    snapshot_path = snapshot_path_for_target(scan.id, target)
    snapshot_path.parent.mkdir(parents=True, exist_ok=True)
    snapshot_path.write_text(content, encoding="utf-8")

    content_hash = f"sha256:{hashlib.sha256(content.encode('utf-8')).hexdigest()}"
    hashes = json.loads(scan.content_hashes_json or "[]")
    if content_hash not in hashes:
        hashes.append(content_hash)
    scan.content_hashes_json = dump_json(hashes)
    return snapshot_path


def snapshot_path_for_target(scan_id: str, target: InvestigationTarget) -> Path:
    snapshot_dir = get_settings().live_snapshot_dir
    if target.origin == "configured":
        return snapshot_dir / f"{scan_id}-configured-source.txt"
    url_hash = hashlib.sha256(target.source_url.encode("utf-8")).hexdigest()[:12]
    return snapshot_dir / f"{scan_id}-{target.signal_type}-{url_hash}.txt"


def target_from_capture_trace(company: Company, trace: BrightDataTrace) -> InvestigationTarget | None:
    if trace.product != "web_unlocker" or trace.status != "success" or not trace.source_url:
        return None
    pieces = trace.operation.split(":")
    if len(pieces) != 3 or pieces[0] != "capture_text" or pieces[1] not in QUERY_TEMPLATES:
        return None
    return InvestigationTarget(trace.source_url, pieces[1], source_type_for_url(company, trace.source_url), pieces[2])


def _targets_from_serp(company: Company, signal_type: str, content: str) -> list[InvestigationTarget]:
    try:
        payload = json.loads(content)
    except (TypeError, json.JSONDecodeError):
        return []
    organic = payload.get("organic", []) if isinstance(payload, dict) else []
    if not isinstance(organic, list):
        return []

    targets: list[InvestigationTarget] = []
    for result in organic:
        if not isinstance(result, dict):
            continue
        url = result.get("link") or result.get("url")
        if not isinstance(url, str) or not _public_https_url(url) or _blocked(company, url):
            continue
        source_type = source_type_for_url(company, url)
        vendor_owned = source_type == "vendor_owned"
        if signal_type != "adverse_media" and not vendor_owned:
            continue
        targets.append(InvestigationTarget(url, signal_type, source_type, "serp"))
        if len(targets) >= 2:
            break
    return targets


def _dedupe_targets(targets: list[InvestigationTarget]) -> list[InvestigationTarget]:
    result: list[InvestigationTarget] = []
    seen: set[str] = set()
    for target in targets:
        if target.source_url in seen:
            continue
        seen.add(target.source_url)
        result.append(target)
    return result


def _belongs_to_vendor(company: Company, url: str) -> bool:
    host = (urlsplit(url).hostname or "").casefold()
    domain = company.domain.casefold()
    return host == domain or host.endswith(f".{domain}")


def source_type_for_url(company: Company, url: str) -> str:
    host = (urlsplit(url).hostname or "").casefold()
    if _belongs_to_vendor(company, url):
        return "vendor_owned"
    if host.endswith(".gov") or ".gov." in host or "regulator" in host:
        return "regulator"
    if any(token in host for token in ("news", "reuters", "bleepingcomputer", "theregister")):
        return "news"
    return "general_web"


def _public_https_url(url: str) -> bool:
    try:
        parsed = urlsplit(url)
        host = (parsed.hostname or "").casefold()
        return (
            parsed.scheme == "https"
            and bool(host)
            and host not in {"localhost", "127.0.0.1", "::1"}
            and parsed.username is None
            and parsed.password is None
            and parsed.port in {None, 443}
        )
    except ValueError:
        return False


def _blocked(company: Company, url: str) -> bool:
    return any(url.startswith(rule) for rule in parse_json_list(company.block_list_json))


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
