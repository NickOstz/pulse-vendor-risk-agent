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


def load_replay_review(session: Session, company: Company, scan: Scan) -> None:
    """Insert deterministic cached demo data for the curated vendor.

    This is intentionally labeled replay/cached data. Live Bright Data,
    extraction, verification, scoring, and brief services can replace this
    adapter behind the same scan/evidence/trace tables.
    """
    payload = json.loads(_seed_path("replay_dataforge_review.json").read_text(encoding="utf-8"))
    now = utc_now()
    evidence_id_map: dict[str, str] = {}

    scan.status = "running"
    scan.mode = "replay"
    scan.current_stage = "collect"
    scan.serp_queries_used = payload["metrics"]["serp_queries_used"]
    scan.urls_scraped = payload["metrics"]["urls_scraped"]
    scan.llm_calls_used = payload["metrics"]["llm_calls_used"]
    scan.source_count = payload["metrics"]["source_count"]
    scan.content_hashes_json = dump_json(payload["content_hashes"])

    for trace_row in payload["traces"]:
        session.add(
            BrightDataTrace(
                scan_id=scan.id,
                company_id=company.id,
                product=trace_row["product"],
                operation=trace_row["operation"],
                source_url=trace_row.get("source_url"),
                status=trace_row["status"],
                latency_ms=trace_row.get("latency_ms"),
                retry_count=trace_row.get("retry_count", 0),
                error=trace_row.get("error"),
                source_mode=trace_row["source_mode"],
                created_at=now,
            )
        )

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
        session.flush()
        evidence_id_map[evidence_row["fixture_id"]] = evidence.id

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
    scan.status = "completed"
    scan.completed_at = now
    company.agent_status = "completed"
    company.last_agent_run_at = now
    company.next_agent_run_at = None
    session.add(scan)
    session.add(company)
    session.commit()
