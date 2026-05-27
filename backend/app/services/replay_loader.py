import json
from datetime import date
from pathlib import Path

from sqlmodel import Session, select

from app.config import get_settings
from app.models import Alert, BrightDataTrace, Brief, Company, EvidenceItem, Scan, utc_now
from app.services.brief_renderer import render_vendor_review_brief
from app.services.assessment import draft_verified_assessment
from app.services.change_detection import classify_live_evidence_changes
from app.services.extraction import ExtractedEvidence
from app.services.live_evidence import extract_live_source_evidence_items, is_demo_company, source_rules_allow
from app.services.scoring import (
    build_live_compliance_alert,
    build_live_signal_alert,
    build_mixed_related_change_alert,
    build_related_live_signal_alert,
)
from app.services.serializers import dump_json, next_review_after_run


def _seed_path(name: str) -> Path:
    return get_settings().replay_dir / name


def replay_data_available() -> bool:
    return _seed_path("companies.json").exists() and _seed_path("replay_cloudflare_review.json").exists()


def load_replay_payload() -> dict:
    return json.loads(_seed_path("replay_cloudflare_review.json").read_text(encoding="utf-8"))


def seed_companies(session: Session) -> None:
    payload = json.loads(_seed_path("companies.json").read_text(encoding="utf-8"))
    for row in payload["companies"]:
        company = Company(
            id=row["id"],
            name=row["name"],
            domain=row["domain"],
            relationship_type=row["relationship_type"],
            owner=row["owner"],
            criticality=row["criticality"],
            renewal_date=date.fromisoformat(row["renewal_date"]),
            allow_list_json=dump_json(row.get("allow_list", [])),
            block_list_json=dump_json(row.get("block_list", [])),
            agent_enabled=row.get("agent_enabled", False),
            agent_status=row.get("agent_status", "inactive"),
            review_policy=row.get("review_policy"),
            last_agent_run_at=row.get("last_agent_run_at"),
            next_agent_run_at=row.get("next_agent_run_at"),
        )
        session.add(company)
    session.commit()


def prepare_replay_scan(session: Session, company: Company, scan: Scan) -> None:
    payload = load_replay_payload()
    scan.status = "running"
    scan.current_stage = "collect"
    scan.serp_queries_used = 0
    scan.urls_scraped = 0
    scan.llm_calls_used = 0
    scan.source_count = 0
    scan.evidence_count = 0
    scan.verified_count = 0
    scan.content_hashes_json = dump_json(payload["content_hashes"])
    company.agent_status = "running"
    session.add(scan)
    session.add(company)
    session.commit()


def advance_replay_scan(session: Session, company: Company, scan: Scan) -> None:
    """Move a replay scan forward one observable stage after a status poll."""
    if scan.status != "running":
        return
    if scan.current_stage == "collect":
        _complete_collect(session, company, scan)
    elif scan.current_stage == "extract":
        _complete_extract(session, company, scan)
    elif scan.current_stage == "verify":
        _complete_verify(session, scan)
    elif scan.current_stage == "score":
        _complete_score(session, company, scan)
    elif scan.current_stage == "brief":
        _complete_brief(session, company, scan)


def _complete_collect(session: Session, company: Company, scan: Scan) -> None:
    payload = load_replay_payload()
    now = utc_now()
    live_with_fallback = scan.mode == "live_with_fallback"
    uses_demo_payload = is_demo_company(company)
    if not live_with_fallback and uses_demo_payload:
        scan.serp_queries_used = payload["metrics"]["serp_queries_used"]
    if not live_with_fallback and uses_demo_payload:
        scan.urls_scraped = 0
    if uses_demo_payload:
        scan.llm_calls_used = 0 if live_with_fallback else payload["metrics"]["llm_calls_used"]
    if not live_with_fallback and uses_demo_payload:
        scan.source_count = 0

    for trace_row in payload["traces"] if uses_demo_payload else []:
        if live_with_fallback and trace_row["product"] == "serp_api":
            continue
        source_url = trace_row.get("source_url")
        is_page_source = trace_row["product"] != "serp_api"
        if is_page_source and source_url and not source_rules_allow(company, source_url):
            continue
        if is_page_source:
            scan.source_count += 1
            if not live_with_fallback:
                scan.urls_scraped += 1
        session.add(
            BrightDataTrace(
                scan_id=scan.id,
                company_id=company.id,
                product=trace_row["product"],
                operation=trace_row["operation"],
                source_url=trace_row.get("source_url"),
                status="fallback_used" if live_with_fallback else trace_row["status"],
                latency_ms=trace_row.get("latency_ms"),
                retry_count=trace_row.get("retry_count", 0),
                error=trace_row.get("error"),
                source_mode="fallback" if live_with_fallback else trace_row["source_mode"],
                created_at=now,
            )
        )
    scan.current_stage = "extract"
    session.add(scan)
    session.commit()


def _complete_extract(session: Session, company: Company, scan: Scan) -> None:
    payload = load_replay_payload()
    now = utc_now()
    scan.current_stage = "extract"
    live_evidence_items = (
        extract_live_source_evidence_items(session, company, scan)
        if scan.mode in {"live", "live_with_fallback"}
        else []
    )
    verified_live_urls: set[str] = set()
    for live_evidence in live_evidence_items:
        session.add(live_evidence)
        session.flush()
        if live_evidence.support_status == "verified":
            verified_live_urls.add(live_evidence.source_url)
            _remove_replaced_fallback_trace(session, scan, live_evidence.source_url)

    for evidence_row in payload["evidence_items"] if is_demo_company(company) else []:
        if not source_rules_allow(company, evidence_row["source_url"]):
            continue
        if evidence_row["source_url"] in verified_live_urls:
            continue
        candidate = ExtractedEvidence.model_validate(
            {
                "vendor_id": company.id,
                "signal_type": evidence_row["signal_type"],
                "claim": evidence_row["claim"],
                "supporting_quote": evidence_row["supporting_quote"],
                "source_url": evidence_row["source_url"],
                "source_type": evidence_row["source_type"],
                "published_or_captured_at": now,
                "severity_hint": evidence_row["severity_hint"],
                "confidence": evidence_row["confidence"],
                "recommended_action": evidence_row["recommended_action"],
            }
        )
        evidence = EvidenceItem(
            scan_id=scan.id,
            company_id=company.id,
            signal_type=candidate.signal_type,
            claim=candidate.claim,
            supporting_quote=candidate.supporting_quote,
            source_url=candidate.source_url,
            source_type=candidate.source_type,
            published_or_captured_at=candidate.published_or_captured_at,
            severity_hint=candidate.severity_hint,
            confidence=candidate.confidence,
            recommended_action=candidate.recommended_action,
            support_status=evidence_row["support_status"],
            quote_match_score=evidence_row.get("quote_match_score"),
            snapshot_path=evidence_row.get("snapshot_path"),
            source_excerpt=evidence_row.get("source_excerpt"),
            created_at=now,
        )
        session.add(evidence)
    session.flush()
    scan.evidence_count = len(session.exec(select(EvidenceItem).where(EvidenceItem.scan_id == scan.id)).all())
    scan.current_stage = "verify"
    session.add(scan)
    session.commit()


def _complete_verify(session: Session, scan: Scan) -> None:
    verified_count = session.exec(
        select(EvidenceItem).where(EvidenceItem.scan_id == scan.id, EvidenceItem.support_status == "verified")
    ).all()
    evidence_count = session.exec(select(EvidenceItem).where(EvidenceItem.scan_id == scan.id)).all()
    scan.evidence_count = len(evidence_count)
    scan.verified_count = len(verified_count)
    scan.current_stage = "score"
    session.add(scan)
    session.commit()


def _complete_score(session: Session, company: Company, scan: Scan) -> None:
    payload = load_replay_payload()
    now = utc_now()
    evidence_id_map = _evidence_id_map(session, scan.id)
    live_evidence_items = _verified_live_evidence(session, scan.id)
    live_change_statuses = classify_live_evidence_changes(session, scan, live_evidence_items)
    actionable_live_evidence = [
        item for item in live_evidence_items if live_change_statuses.get(item.id) != "unchanged"
    ]
    scan.current_stage = "score"
    for alert_row in payload["alerts"] if is_demo_company(company) else []:
        if actionable_live_evidence and alert_row["alert_type"] == "related_change":
            continue
        related_fixture_ids = alert_row.get("related_evidence_fixture_ids", [])
        related_ids = [evidence_id_map[item] for item in related_fixture_ids if item in evidence_id_map]
        evidence_fixture_id = alert_row.get("evidence_fixture_id")
        if evidence_fixture_id and evidence_fixture_id not in evidence_id_map:
            continue
        if alert_row["alert_type"] == "related_change" and len(related_ids) < 2:
            continue
        session.add(
            Alert(
                company_id=company.id,
                scan_id=scan.id,
                evidence_item_id=evidence_id_map.get(evidence_fixture_id) if evidence_fixture_id else None,
                alert_type=alert_row["alert_type"],
                title=alert_row["title"],
                summary=alert_row["summary"],
                score=alert_row["score"],
                severity=alert_row["severity"],
                status=alert_row.get("status", "new"),
                owner=alert_row["owner"],
                recommended_action=alert_row["recommended_action"],
                related_evidence_ids_json=dump_json(related_ids),
                score_factors_json=dump_json(alert_row.get("score_factors", {})),
                created_at=now,
            )
        )
    for live_evidence in actionable_live_evidence:
        change_status = live_change_statuses.get(live_evidence.id)
        live_alert = build_live_signal_alert(company, scan, live_evidence, change_status)
        if is_demo_company(company) and live_evidence.signal_type == "trust_security":
            live_alert = build_live_compliance_alert(company, scan, live_evidence, change_status)
        if live_alert is not None:
            session.add(live_alert)
    if is_demo_company(company) and actionable_live_evidence:
        pricing_evidence = session.exec(
            select(EvidenceItem).where(
                EvidenceItem.scan_id == scan.id,
                EvidenceItem.signal_type == "pricing_terms",
                EvidenceItem.support_status == "verified",
            )
        ).first()
        trust_evidence = next(
            (item for item in actionable_live_evidence if item.signal_type == "trust_security"), None
        )
        if pricing_evidence is not None and trust_evidence is not None:
            session.add(build_mixed_related_change_alert(company, scan, trust_evidence, pricing_evidence))
    elif actionable_live_evidence:
        related_alert = build_related_live_signal_alert(company, scan, actionable_live_evidence)
        if related_alert is not None:
            session.add(related_alert)
    scan.current_stage = "brief"
    session.add(scan)
    session.commit()


def _complete_brief(session: Session, company: Company, scan: Scan) -> None:
    now = utc_now()
    evidence_items = session.exec(select(EvidenceItem).where(EvidenceItem.scan_id == scan.id)).all()
    verified_items = [item for item in evidence_items if item.support_status == "verified"]
    traces = session.exec(select(BrightDataTrace).where(BrightDataTrace.scan_id == scan.id)).all()
    change_statuses = (
        classify_live_evidence_changes(session, scan, _verified_live_evidence(session, scan.id))
        if scan.mode == "live"
        else None
    )
    assessment = draft_verified_assessment(company, scan, verified_items) if scan.mode == "live" else None
    markdown, html = render_vendor_review_brief(company, verified_items, traces, assessment, change_statuses)
    session.add(Brief(company_id=company.id, scan_id=scan.id, markdown=markdown, html=html, created_at=now))

    scan.evidence_count = len(evidence_items)
    scan.verified_count = len(verified_items)
    scan.current_stage = "brief"
    scan.status = (
        "completed_with_fallback"
        if any(trace.source_mode == "fallback" for trace in traces)
        else "completed"
    )
    scan.completed_at = now
    company.agent_status = "completed"
    company.last_agent_run_at = now
    company.next_agent_run_at = next_review_after_run(company, now)
    session.add(scan)
    session.add(company)
    session.commit()


def _evidence_id_map(session: Session, scan_id: str) -> dict[str, str]:
    payload = load_replay_payload()
    evidence_rows = session.exec(select(EvidenceItem).where(EvidenceItem.scan_id == scan_id)).all()
    result: dict[str, str] = {}
    for fixture in payload["evidence_items"]:
        for evidence in evidence_rows:
            if (
                evidence.source_url == fixture["source_url"]
                and evidence.supporting_quote == fixture["supporting_quote"]
            ):
                result[fixture["fixture_id"]] = evidence.id
                break
    return result


def _verified_live_evidence(session: Session, scan_id: str) -> list[EvidenceItem]:
    from app.services.live_collection import snapshot_path_for_target, target_from_capture_trace

    live_traces = session.exec(
            select(BrightDataTrace).where(
                BrightDataTrace.scan_id == scan_id,
                BrightDataTrace.source_mode == "live",
                BrightDataTrace.status == "success",
                BrightDataTrace.product == "web_unlocker",
            )
        ).all()
    if not live_traces:
        return []
    company_id = live_traces[0].company_id
    company = session.get(Company, company_id)
    if company is None:
        return []
    live_snapshot_paths = {
        str(snapshot_path_for_target(scan_id, target))
        for trace in live_traces
        if (target := target_from_capture_trace(company, trace)) is not None
    }
    if not live_snapshot_paths:
        return []
    return list(session.exec(
        select(EvidenceItem).where(
            EvidenceItem.scan_id == scan_id,
            EvidenceItem.support_status == "verified",
            EvidenceItem.snapshot_path.in_(live_snapshot_paths),
        )
    ).all())


def _remove_replaced_fallback_trace(session: Session, scan: Scan, source_url: str) -> None:
    duplicate_fallback_traces = session.exec(
        select(BrightDataTrace).where(
            BrightDataTrace.scan_id == scan.id,
            BrightDataTrace.source_url == source_url,
            BrightDataTrace.source_mode == "fallback",
        )
    ).all()
    for trace in duplicate_fallback_traces:
        session.delete(trace)
    scan.source_count = max(0, scan.source_count - len(duplicate_fallback_traces))
