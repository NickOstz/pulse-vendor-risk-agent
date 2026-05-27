import json
from typing import Protocol

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.config import get_settings
from app.models import Company, EvidenceItem, Scan
from app.services.extraction import (
    MAX_LLM_CALLS_PER_REVIEW,
    DeepSeekExtractionClient,
    ExtractionClientError,
)


class AssessmentDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    executive_summary: str = Field(min_length=1)
    risk_interpretation: str = Field(min_length=1)
    recommended_actions: list[str] = Field(min_length=1, max_length=5)


class AssessmentClient(Protocol):
    def complete_json(self, prompt: str) -> str:
        ...


def draft_verified_assessment(
    company: Company,
    scan: Scan,
    verified_items: list[EvidenceItem],
    client: AssessmentClient | None = None,
) -> AssessmentDraft | None:
    if len(verified_items) < 2 or scan.llm_calls_used >= MAX_LLM_CALLS_PER_REVIEW:
        return None
    settings = get_settings()
    model_client = client
    if model_client is None:
        if not settings.llm_extraction_enabled or not settings.deepseek_api_key:
            return None
        model_client = DeepSeekExtractionClient(
            api_key=settings.deepseek_api_key,
            endpoint=settings.deepseek_api_endpoint,
            model=settings.deepseek_extraction_model,
            timeout_seconds=settings.llm_extraction_timeout_seconds,
        )
    scan.llm_calls_used += 1
    try:
        raw = model_client.complete_json(_assessment_prompt(company, verified_items))
        return AssessmentDraft.model_validate_json(raw)
    except (ExtractionClientError, ValidationError, ValueError):
        return None


def _assessment_prompt(company: Company, verified_items: list[EvidenceItem]) -> str:
    evidence_payload = [
        {
            "signal_type": item.signal_type,
            "claim": item.claim,
            "supporting_quote": item.supporting_quote,
            "source_url": item.source_url,
            "severity_hint": item.severity_hint,
            "recommended_action": item.recommended_action,
        }
        for item in verified_items
    ]
    schema = {
        "executive_summary": "Concise assessment using verified findings only.",
        "risk_interpretation": "Why the verified findings require review without asserting an unproven incident.",
        "recommended_actions": ["Concrete review action based only on verified findings."],
    }
    return (
        "Produce a structured vendor risk assessment from verified public-source findings only. "
        "Do not introduce facts, incidents, or changes not contained in the evidence. "
        "Return JSON only matching this schema:\n"
        f"{json.dumps(schema)}\nVendor: {company.name}\nVerified evidence:\n{json.dumps(evidence_payload)}"
    )
