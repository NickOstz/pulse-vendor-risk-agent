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
    "trust_security": "site:{domain} {name} trust security privacy compliance SOC 2 ISO 27001",
    "pricing_terms": "site:{domain} {name} pricing terms subscription legal renewal",
    "adverse_media": "{name} {domain} breach incident outage lawsuit regulatory enforcement",
}
POSITIVE_TARGET_TERMS = {
    "trust_security": (
        "trust",
        "trust-center",
        "security",
        "security-center",
        "privacy",
        "compliance",
        "certification",
        "certifications",
        "soc",
        "iso",
        "gdpr",
        "hipaa",
        "pci",
        "legal",
        "data-protection",
        "data-processing",
        "dpa",
        "subprocessor",
        "subprocessors",
    ),
    "pricing_terms": (
        "pricing",
        "terms",
        "terms-of-service",
        "subscription",
        "billing",
        "invoice",
        "invoices",
        "legal",
        "plans",
        "license",
        "renewal",
        "payment",
        "refund",
        "agreement",
        "service-agreement",
        "dpa",
        "msa",
    ),
    "adverse_media": (
        "breach",
        "incident",
        "outage",
        "disruption",
        "lawsuit",
        "regulatory",
        "enforcement",
        "security",
        "vulnerability",
        "compromise",
        "leak",
        "leaked",
        "exposure",
        "cve",
    ),
}
LOW_VALUE_PATH_TERMS = (
    "signin",
    "sign-in",
    "login",
    "log-in",
    "signup",
    "sign-up",
    "register",
    "account",
    "dashboard",
    "checkout",
    "cart",
    "help",
    "faq",
    "support",
    "contact",
    "careers",
    "jobs",
    "blog",
    "blogs",
    "guide",
    "guides",
    "kb",
    "knowledge-base",
    "resource",
    "resources",
    "customer",
    "customers",
    "case-study",
    "case-studies",
    "webinar",
    "event",
    "events",
)
ADVERSE_INCIDENT_PHRASES = (
    "security breach",
    "data breach",
    "pwn request",
    "unauthorized",
    "exfiltrat",
    "vulnerability",
    "incident response",
    "postmortem",
    "root cause",
)
ADVERSE_GENERIC_PROFILE_TERMS = (
    "security rating",
    "vendor risk report",
    "security-report",
    "security report",
    "data protection report",
    "company profile",
    "threat-center",
    "threat center",
    "attack surface",
    "external attack surface",
    "risk profile",
)
ADVERSE_LOW_AUTHORITY_HOST_TERMS = (
    "reddit.com",
    "news.ycombinator.com",
    "hackernews",
    "hn.algolia.com",
)
ADVERSE_PROMOTIONAL_SECURITY_HOST_TERMS = (
    "guardz.com",
    "ionix.io",
    "upguard.com",
    "securityscorecard.com",
    "blackkite.com",
    "bitsight.com",
)
KNOWN_NEWS_HOST_TERMS = (
    "bleepingcomputer.com",
    "cybersecuritydive.com",
    "darkreading.com",
    "reuters.com",
    "therecord.media",
    "thehackernews.com",
    "theregister.com",
)
KNOWN_RESEARCH_HOST_TERMS = (
    "stepsecurity.io",
)


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

    ranked_targets: list[tuple[int, InvestigationTarget]] = []
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
        score = _serp_target_score(signal_type, url, result)
        if score <= 0:
            continue
        ranked_targets.append((score, InvestigationTarget(url, signal_type, source_type, "serp")))

    ranked_targets.sort(key=lambda item: item[0], reverse=True)
    return [target for _, target in ranked_targets[:3]]


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
    if any(token in host for token in KNOWN_NEWS_HOST_TERMS) or "news" in host:
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


def _serp_target_score(signal_type: str, url: str, result: dict) -> int:
    parsed = urlsplit(url)
    host = (parsed.hostname or "").casefold()
    path = parsed.path.casefold()
    if path.endswith(".xml") or "sitemap" in path:
        return 0
    haystack = " ".join(
        str(value)
        for value in (
            path,
            parsed.query,
            result.get("title"),
            result.get("description"),
            result.get("snippet"),
        )
        if value
    ).casefold()
    score = 0
    for term in POSITIVE_TARGET_TERMS[signal_type]:
        if term in haystack:
            score += 3
    if parsed.path in {"", "/"}:
        score -= 2
    for term in LOW_VALUE_PATH_TERMS:
        if signal_type == "trust_security" and term in {
            "blog",
            "blogs",
            "guide",
            "guides",
            "kb",
            "knowledge-base",
            "resource",
            "resources",
        }:
            continue
        if term in haystack:
            score -= 4
    if signal_type == "adverse_media":
        if any(term in host for term in ADVERSE_LOW_AUTHORITY_HOST_TERMS):
            score -= 20
        if any(term in host for term in ADVERSE_PROMOTIONAL_SECURITY_HOST_TERMS):
            score -= 30
        if any(term in host for term in KNOWN_NEWS_HOST_TERMS + KNOWN_RESEARCH_HOST_TERMS):
            score += 8
        for phrase in ADVERSE_INCIDENT_PHRASES:
            if phrase in haystack:
                score += 5
        for phrase in ADVERSE_GENERIC_PROFILE_TERMS:
            if phrase in haystack:
                score -= 10
    return score


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
