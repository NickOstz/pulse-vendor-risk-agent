import json
from urllib.parse import urlsplit

from sqlmodel import Session, select

from app.config import get_settings
from app.models import BrightDataTrace, Company, EvidenceItem, Scan
from app.services.extraction import configured_extraction_client, extract_source


DEMO_COMPANY_ID = "vendor-cloudflare-demo"
CLOUDFLARE_TRUST_HUB_URL = "https://www.cloudflare.com/trust-hub/"


def is_demo_company(company: Company) -> bool:
    return company.id == DEMO_COMPANY_ID


def configured_live_source_url(company: Company) -> str | None:
    if is_demo_company(company):
        configured_source = get_settings().brightdata_demo_source_url
        if configured_source and is_supported_live_source(company, configured_source):
            return configured_source
        return None

    for source_url in _read_rules(company.allow_list_json):
        if is_supported_live_source(company, source_url):
            return source_url
    return None


def is_supported_live_source(company: Company, source_url: str) -> bool:
    if not source_rules_allow(company, source_url):
        return False
    if is_demo_company(company):
        return company.domain == "cloudflare.com" and source_url == CLOUDFLARE_TRUST_HUB_URL

    try:
        parsed = urlsplit(source_url)
        host = (parsed.hostname or "").casefold()
        domain = company.domain.casefold()
        allowed_host = host == domain or host.endswith(f".{domain}")
        return (
            parsed.scheme == "https"
            and parsed.username is None
            and parsed.password is None
            and parsed.port in {None, 443}
            and allowed_host
        )
    except ValueError:
        return False


def source_rules_allow(company: Company, source_url: str) -> bool:
    allow_list = _read_rules(company.allow_list_json)
    block_list = _read_rules(company.block_list_json)
    return source_url not in block_list and (not allow_list or source_url in allow_list)


def _read_rules(serialized_rules: str | None) -> list[str]:
    if not serialized_rules:
        return []
    parsed = json.loads(serialized_rules)
    return parsed if isinstance(parsed, list) else []


def extract_live_source_evidence_items(session: Session, company: Company, scan: Scan) -> list[EvidenceItem]:
    from app.services.live_collection import snapshot_path_for_target, target_from_capture_trace

    settings = get_settings()
    extraction_client = configured_extraction_client(settings)
    if extraction_client is None:
        return []

    traces = session.exec(
        select(BrightDataTrace).where(
            BrightDataTrace.scan_id == scan.id,
            BrightDataTrace.source_mode == "live",
            BrightDataTrace.product == "web_unlocker",
            BrightDataTrace.status == "success",
        )
    ).all()
    evidence_items: list[EvidenceItem] = []
    for trace in traces:
        target = target_from_capture_trace(company, trace)
        if target is None:
            continue
        snapshot_path = snapshot_path_for_target(scan.id, target)
        if not snapshot_path.exists():
            continue
        content = snapshot_path.read_text(encoding="utf-8")
        evidence_items.append(
            extract_source(
                company=company,
                scan=scan,
                source_text=content,
                source_url=target.source_url,
                source_type=target.source_type,
                snapshot_path=snapshot_path,
                signal_type=target.signal_type,
                client=extraction_client,
            )
        )
    return evidence_items
