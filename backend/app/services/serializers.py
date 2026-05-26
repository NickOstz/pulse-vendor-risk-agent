import json
from datetime import UTC, date, datetime, timedelta

from app.models import Alert, Company, Scan
from app.schemas import AlertRead, CompanyRead, ScanMetrics, ScanRead, StageRead


STAGES = ["collect", "extract", "verify", "score", "brief"]


def parse_json_list(value: str | None) -> list[str]:
    if not value:
        return []
    data = json.loads(value)
    return data if isinstance(data, list) else []


def parse_json_dict(value: str | None) -> dict:
    if not value:
        return {}
    data = json.loads(value)
    return data if isinstance(data, dict) else {}


def dump_json(value: list | dict) -> str:
    return json.dumps(value, separators=(",", ":"))


def company_to_read(company: Company) -> CompanyRead:
    return CompanyRead(
        id=company.id,
        name=company.name,
        domain=company.domain,
        relationship_type=company.relationship_type,
        owner=company.owner,
        criticality=company.criticality,
        renewal_date=company.renewal_date,
        allow_list=parse_json_list(company.allow_list_json),
        block_list=parse_json_list(company.block_list_json),
        agent_enabled=company.agent_enabled,
        agent_status=company.agent_status,
        review_policy=company.review_policy,
        last_agent_run_at=as_utc(company.last_agent_run_at),
        next_agent_run_at=as_utc(company.next_agent_run_at),
    )


def alert_to_read(alert: Alert) -> AlertRead:
    return AlertRead(
        id=alert.id,
        company_id=alert.company_id,
        scan_id=alert.scan_id,
        evidence_item_id=alert.evidence_item_id,
        alert_type=alert.alert_type,
        title=alert.title,
        summary=alert.summary,
        score=alert.score,
        severity=alert.severity,
        status=alert.status,
        owner=alert.owner,
        recommended_action=alert.recommended_action,
        related_evidence_ids=parse_json_list(alert.related_evidence_ids_json),
        score_factors=parse_json_dict(alert.score_factors_json),
        created_at=alert.created_at,
    )


def scan_to_read(scan: Scan) -> ScanRead:
    return ScanRead(
        id=scan.id,
        company_id=scan.company_id,
        status=scan.status,
        mode=scan.mode,
        current_stage=scan.current_stage,
        started_at=scan.started_at,
        completed_at=scan.completed_at,
        stages=stage_statuses(scan),
        metrics=ScanMetrics(
            serp_queries_used=scan.serp_queries_used,
            urls_scraped=scan.urls_scraped,
            llm_calls_used=scan.llm_calls_used,
            evidence_count=scan.evidence_count,
            verified_count=scan.verified_count,
            source_count=scan.source_count,
        ),
        error=scan.error,
    )


def stage_statuses(scan: Scan) -> list[StageRead]:
    if scan.status in {"failed"}:
        return [
            StageRead(
                name=stage,
                status="failed" if stage == scan.current_stage else _stage_state(stage, scan.current_stage),
            )
            for stage in STAGES
        ]
    if scan.status in {"completed", "completed_with_fallback"}:
        return [StageRead(name=stage, status="completed") for stage in STAGES]
    return [StageRead(name=stage, status=_stage_state(stage, scan.current_stage)) for stage in STAGES]


def _stage_state(stage: str, current_stage: str) -> str:
    stage_index = STAGES.index(stage)
    current_index = STAGES.index(current_stage)
    if stage_index < current_index:
        return "completed"
    if stage_index == current_index:
        return "running"
    return "pending"


def now_utc() -> datetime:
    return datetime.now(UTC)


def as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def policy_for_company(company: Company) -> tuple[str, datetime | None]:
    today = date.today()
    days_to_renewal = (company.renewal_date - today).days
    now = now_utc()
    if company.criticality == "critical" and days_to_renewal <= 60:
        return "critical_renewal_due", now
    if company.criticality in {"critical", "important"}:
        return "weekly", now + timedelta(days=7)
    return "manual_low_frequency", None


def apply_agent_state(company: Company, enabled: bool) -> None:
    company.agent_enabled = enabled
    company.updated_at = now_utc()
    if enabled:
        company.review_policy, company.next_agent_run_at = policy_for_company(company)
        company.agent_status = "active"
    else:
        company.agent_status = "inactive"
        company.review_policy = None
        company.next_agent_run_at = None
