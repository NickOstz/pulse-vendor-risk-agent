from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


AgentStatus = Literal["inactive", "active", "running", "completed", "needs_review"]
ScanStatus = Literal["queued", "running", "completed", "failed", "completed_with_fallback"]
ScanMode = Literal["live", "replay", "live_with_fallback"]
StageName = Literal["collect", "extract", "verify", "score", "brief"]
StageStatus = Literal["pending", "running", "completed", "failed"]
SupportStatus = Literal["verified", "needs_review", "no_evidence", "failed_source"]
SourceMode = Literal["live", "cached", "fallback"]
Criticality = Literal["critical", "important", "normal"]
SignalType = Literal["trust_security", "adverse_media", "pricing_terms"]
AlertStatus = Literal["new", "approved", "dismissed", "needs_review"]


class CompanyCreate(BaseModel):
    name: str = Field(min_length=1)
    domain: str = Field(min_length=1)
    relationship_type: str = Field(default="vendor", min_length=1)
    owner: str = Field(min_length=1)
    criticality: Criticality
    renewal_date: date
    allow_list: list[str] = Field(default_factory=list)
    block_list: list[str] = Field(default_factory=list)

    @field_validator("domain")
    @classmethod
    def validate_domain(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "://" in normalized or "/" in normalized or "." not in normalized:
            raise ValueError("domain must be an exact host such as vendor.com")
        return normalized


class CompanyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    domain: str
    relationship_type: str
    owner: str
    criticality: Criticality
    renewal_date: date
    allow_list: list[str] = Field(default_factory=list)
    block_list: list[str] = Field(default_factory=list)
    agent_enabled: bool
    agent_status: AgentStatus
    review_policy: str | None
    last_agent_run_at: datetime | None
    next_agent_run_at: datetime | None


class AgentToggle(BaseModel):
    agent_enabled: bool


class StageRead(BaseModel):
    name: StageName
    status: StageStatus


class ScanMetrics(BaseModel):
    serp_queries_used: int
    urls_scraped: int
    llm_calls_used: int
    evidence_count: int
    verified_count: int
    source_count: int = 0


class ScanRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company_id: str
    status: ScanStatus
    mode: ScanMode
    current_stage: StageName
    started_at: datetime
    completed_at: datetime | None
    stages: list[StageRead]
    metrics: ScanMetrics
    error: str | None = None


class ActiveRun(BaseModel):
    company_id: str
    scan_id: str
    current_stage: StageName


class AgentStatusRead(BaseModel):
    active_runs: list[ActiveRun]
    due_vendors: list[CompanyRead]


class AgentTickRead(BaseModel):
    started_scan_ids: list[str]
    due_vendor_ids: list[str]


class EvidenceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    scan_id: str
    company_id: str
    signal_type: SignalType
    claim: str
    supporting_quote: str
    source_url: str
    source_type: str
    published_or_captured_at: datetime
    severity_hint: Literal["low", "medium", "high"]
    confidence: float
    recommended_action: str
    support_status: SupportStatus
    quote_match_score: float | None
    snapshot_path: str | None
    source_excerpt: str | None
    created_at: datetime


class AlertRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company_id: str
    scan_id: str
    evidence_item_id: str | None
    alert_type: Literal["signal", "related_change"]
    title: str
    summary: str
    score: int
    severity: Literal["low", "medium", "high"]
    status: AlertStatus
    owner: str
    recommended_action: str
    related_evidence_ids: list[str] = Field(default_factory=list)
    score_factors: dict = Field(default_factory=dict)
    created_at: datetime


class AlertUpdate(BaseModel):
    status: Literal["approved", "dismissed", "needs_review"]


class TraceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    scan_id: str
    company_id: str
    product: str
    operation: str
    source_url: str | None
    status: str
    latency_ms: int | None
    retry_count: int
    error: str | None
    source_mode: SourceMode
    created_at: datetime


class BriefRequest(BaseModel):
    company_id: str
    scan_id: str
    format: Literal["markdown", "html"] = "markdown"


class ManualScanRequest(BaseModel):
    company_id: str


class BriefRead(BaseModel):
    company_id: str
    scan_id: str
    format: Literal["markdown", "html"]
    content: str


class HealthRead(BaseModel):
    status: str
    database: bool
    scheduler: bool
    replay_data: bool
    brightdata_key_present: bool
    llm_key_present: bool
