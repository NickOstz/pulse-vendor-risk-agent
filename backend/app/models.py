from datetime import UTC, date, datetime
from uuid import uuid4

from sqlmodel import Field, SQLModel


def new_id() -> str:
    return str(uuid4())


def utc_now() -> datetime:
    return datetime.now(UTC)


class Company(SQLModel, table=True):
    __tablename__ = "companies"

    id: str = Field(default_factory=new_id, primary_key=True)
    name: str
    domain: str
    relationship_type: str
    owner: str
    criticality: str
    renewal_date: date
    allow_list_json: str = "[]"
    block_list_json: str = "[]"
    agent_enabled: bool = False
    agent_status: str = "inactive"
    review_policy: str | None = None
    last_agent_run_at: datetime | None = None
    next_agent_run_at: datetime | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class Scan(SQLModel, table=True):
    __tablename__ = "scans"

    id: str = Field(default_factory=new_id, primary_key=True)
    company_id: str = Field(foreign_key="companies.id", index=True)
    status: str = "queued"
    mode: str = "replay"
    current_stage: str = "collect"
    started_at: datetime = Field(default_factory=utc_now)
    completed_at: datetime | None = None
    serp_queries_used: int = 0
    urls_scraped: int = 0
    llm_calls_used: int = 0
    source_count: int = 0
    evidence_count: int = 0
    verified_count: int = 0
    content_hashes_json: str = "[]"
    error: str | None = None


class EvidenceItem(SQLModel, table=True):
    __tablename__ = "evidence_items"

    id: str = Field(default_factory=new_id, primary_key=True)
    scan_id: str = Field(foreign_key="scans.id", index=True)
    company_id: str = Field(foreign_key="companies.id", index=True)
    signal_type: str
    claim: str
    supporting_quote: str
    source_url: str
    source_type: str
    published_or_captured_at: datetime
    severity_hint: str
    confidence: float
    recommended_action: str
    support_status: str
    quote_match_score: float | None = None
    snapshot_path: str | None = None
    source_excerpt: str | None = None
    created_at: datetime = Field(default_factory=utc_now)


class Alert(SQLModel, table=True):
    __tablename__ = "alerts"

    id: str = Field(default_factory=new_id, primary_key=True)
    company_id: str = Field(foreign_key="companies.id", index=True)
    scan_id: str = Field(foreign_key="scans.id", index=True)
    evidence_item_id: str | None = Field(default=None, foreign_key="evidence_items.id")
    alert_type: str = "signal"
    title: str
    summary: str
    score: int
    severity: str
    status: str = "new"
    owner: str
    recommended_action: str
    related_evidence_ids_json: str = "[]"
    score_factors_json: str = "{}"
    created_at: datetime = Field(default_factory=utc_now)


class BrightDataTrace(SQLModel, table=True):
    __tablename__ = "brightdata_traces"

    id: str = Field(default_factory=new_id, primary_key=True)
    scan_id: str = Field(foreign_key="scans.id", index=True)
    company_id: str = Field(foreign_key="companies.id", index=True)
    product: str
    operation: str
    source_url: str | None = None
    status: str
    latency_ms: int | None = None
    retry_count: int = 0
    error: str | None = None
    source_mode: str
    created_at: datetime = Field(default_factory=utc_now)


class Brief(SQLModel, table=True):
    __tablename__ = "briefs"

    id: str = Field(default_factory=new_id, primary_key=True)
    company_id: str = Field(foreign_key="companies.id", index=True)
    scan_id: str = Field(foreign_key="scans.id", index=True)
    markdown: str
    html: str
    created_at: datetime = Field(default_factory=utc_now)
