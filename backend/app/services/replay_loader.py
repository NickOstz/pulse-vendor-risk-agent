import json
from datetime import date
from pathlib import Path

from sqlmodel import Session, select

from app.config import get_settings
from app.models import Alert, BrightDataTrace, Brief, Company, EvidenceItem, Scan, utc_now
from app.services.serializers import dump_json


def _seed_path(name: str) -> Path:
    return get_settings().replay_dir / name


def replay_data_available() -> bool:
    return _seed_path("companies.json").exists() and _seed_path("replay_dataforge_review.json").exists()


def load_replay_payload() -> dict:
    return json.loads(_seed_path("replay_dataforge_review.json").read_text(encoding="utf-8"))


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
    if not live_with_fallback:
        scan.serp_queries_used = payload["metrics"]["serp_queries_used"]
    if not live_with_fallback:
        scan.urls_scraped = payload["metrics"]["urls_scraped"]
    scan.llm_calls_used = 0 if live_with_fallback else payload["metrics"]["llm_calls_used"]
    if not live_with_fallback:
        scan.source_count = payload["metrics"]["source_count"]

    for trace_row in payload["traces"]:
        if live_with_fallback and trace_row["product"] == "serp_api":
            continue
        if live_with_fallback:
            scan.source_count += 1
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
    for evidence_row in payload["evidence_items"]:
        evidence = EvidenceItem(
            scan_id=scan.id,
            company_id=company.id,
            signal_type=evidence_row["signal_type"],
            claim=evidence_row["claim"],
            supporting_quote=evidence_row["supporting_quote"],
            source_url=evidence_row["source_url"],
            source_type=evidence_row["source_type"],
            published_or_captured_at=now,
            severity_hint=evidence_row["severity_hint"],
            confidence=evidence_row["confidence"],
            recommended_action=evidence_row["recommended_action"],
            support_status=evidence_row["support_status"],
            quote_match_score=evidence_row.get("quote_match_score"),
            snapshot_path=evidence_row.get("snapshot_path"),
            source_excerpt=evidence_row.get("source_excerpt"),
            created_at=now,
        )
        session.add(evidence)
    scan.evidence_count = len(payload["evidence_items"])
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
    scan.current_stage = "score"
    for alert_row in payload["alerts"]:
        related_fixture_ids = alert_row.get("related_evidence_fixture_ids", [])
        related_ids = [evidence_id_map[item] for item in related_fixture_ids if item in evidence_id_map]
        evidence_fixture_id = alert_row.get("evidence_fixture_id")
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
    scan.current_stage = "brief"
    session.add(scan)
    session.commit()


def _complete_brief(session: Session, company: Company, scan: Scan) -> None:
    payload = load_replay_payload()
    now = utc_now()
    markdown = payload["brief"]["markdown"]
    html = payload["brief"]["html"]
    session.add(Brief(company_id=company.id, scan_id=scan.id, markdown=markdown, html=html, created_at=now))

    verified_count = session.exec(
        select(EvidenceItem).where(EvidenceItem.scan_id == scan.id, EvidenceItem.support_status == "verified")
    ).all()
    evidence_count = session.exec(select(EvidenceItem).where(EvidenceItem.scan_id == scan.id)).all()
    scan.evidence_count = len(evidence_count)
    scan.verified_count = len(verified_count)
    scan.current_stage = "brief"
    scan.status = "completed_with_fallback" if scan.mode == "live_with_fallback" else "completed"
    scan.completed_at = now
    company.agent_status = "completed"
    company.last_agent_run_at = now
    company.next_agent_run_at = None
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
