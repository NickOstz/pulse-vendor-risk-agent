from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Literal, Protocol

import httpx
from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, ValidationError

from app.models import Company, EvidenceItem, Scan, utc_now
from app.services.verification import verify_quote


MAX_LLM_CALLS_PER_REVIEW = 20
MAX_SOURCE_CHARACTERS = 12000
SignalType = Literal["trust_security", "adverse_media", "pricing_terms"]
SourceType = Literal["vendor_owned", "news", "regulator", "general_web"]

TEMPLATE_GUIDANCE: dict[SignalType, str] = {
    "trust_security": "Look only for public trust, security, privacy, certification, or assurance evidence.",
    "adverse_media": "Look only for public incident, outage, breach, enforcement, or adverse reporting evidence.",
    "pricing_terms": "Look only for public pricing, contract, add-on, renewal, or product term evidence.",
}


class ExtractedEvidence(BaseModel):
    """PRD evidence JSON payload returned by structured extraction."""

    model_config = ConfigDict(extra="forbid")

    vendor_id: str = Field(min_length=1)
    signal_type: SignalType
    claim: str = Field(min_length=1)
    supporting_quote: str = Field(min_length=1)
    source_url: str = Field(min_length=1)
    source_type: SourceType
    published_or_captured_at: datetime
    severity_hint: Literal["low", "medium", "high"]
    confidence: float = Field(ge=0, le=1)
    recommended_action: str = Field(min_length=1)


class NoEvidenceExtraction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    vendor_id: str = Field(min_length=1)
    signal_type: SignalType
    source_url: str = Field(min_length=1)
    source_type: SourceType
    support_status: Literal["no_evidence"]
    reason: str = Field(min_length=1)


ExtractionResult = ExtractedEvidence | NoEvidenceExtraction
EXTRACTION_RESULT_ADAPTER = TypeAdapter(ExtractionResult)


class StructuredExtractionClient(Protocol):
    def complete_json(self, prompt: str) -> str:
        ...


class ExtractionClientError(RuntimeError):
    pass


class DeepSeekExtractionClient:
    """Small JSON-mode client for the opt-in live extraction proof path."""

    def __init__(self, api_key: str, endpoint: str, model: str, timeout_seconds: float) -> None:
        self.api_key = api_key
        self.endpoint = endpoint
        self.model = model
        self.timeout_seconds = timeout_seconds

    def complete_json(self, prompt: str) -> str:
        try:
            response = httpx.post(
                self.endpoint,
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                json={
                    "model": self.model,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You extract public vendor-risk evidence. Return only one JSON object that "
                                "matches the requested schema. Never infer a quote that is absent from the source."
                            ),
                        },
                        {"role": "user", "content": prompt},
                    ],
                    "response_format": {"type": "json_object"},
                    "thinking": {"type": "disabled"},
                    "temperature": 0,
                    "max_tokens": 700,
                },
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
        except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
            raise ExtractionClientError("Structured extraction request failed.") from exc
        if not isinstance(content, str) or not content.strip():
            raise ExtractionClientError("Structured extraction returned empty content.")
        return content


def extract_source(
    *,
    company: Company,
    scan: Scan,
    source_text: str,
    source_url: str,
    source_type: SourceType,
    snapshot_path: str | Path,
    signal_type: SignalType,
    client: StructuredExtractionClient,
    captured_at: datetime | None = None,
) -> EvidenceItem:
    captured = captured_at or utc_now()
    for simpler_prompt in (False, True):
        if scan.llm_calls_used >= MAX_LLM_CALLS_PER_REVIEW:
            return _failed_source_item(
                company, scan, source_text, source_url, source_type, snapshot_path, signal_type, captured
            )
        scan.llm_calls_used += 1
        try:
            raw_json = client.complete_json(
                _extraction_prompt(
                    company=company,
                    source_text=source_text,
                    source_url=source_url,
                    source_type=source_type,
                    signal_type=signal_type,
                    captured_at=captured,
                    simpler=simpler_prompt,
                )
            )
            result = EXTRACTION_RESULT_ADAPTER.validate_json(raw_json)
            _require_source_binding(result, company, source_url, source_type, signal_type)
        except (ExtractionClientError, ValidationError, ValueError):
            continue
        if isinstance(result, NoEvidenceExtraction):
            return _no_evidence_item(
                company, scan, source_text, source_url, source_type, snapshot_path, signal_type, captured
            )
        return evidence_from_extraction(
            company=company,
            scan=scan,
            candidate=result,
            source_text=source_text,
            snapshot_path=snapshot_path,
        )
    return _failed_source_item(
        company, scan, source_text, source_url, source_type, snapshot_path, signal_type, captured
    )


def evidence_from_extraction(
    *,
    company: Company,
    scan: Scan,
    candidate: ExtractedEvidence,
    source_text: str,
    snapshot_path: str | Path,
) -> EvidenceItem:
    _require_source_binding(candidate, company, candidate.source_url, candidate.source_type, candidate.signal_type)
    support_status, quote_match_score = verify_quote(source_text, candidate.supporting_quote)
    return EvidenceItem(
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
        support_status=support_status,
        quote_match_score=quote_match_score,
        snapshot_path=str(snapshot_path),
        source_excerpt=source_excerpt(source_text, candidate.supporting_quote),
        created_at=utc_now(),
    )


def source_excerpt(content: str, quote: str) -> str:
    start = content.casefold().find(quote.casefold()) if quote else -1
    if start < 0:
        return content[:240].replace("\n", " ")
    excerpt_start = max(0, start - 48)
    excerpt_end = min(len(content), start + len(quote) + 48)
    return content[excerpt_start:excerpt_end].replace("\n", " ")


def _require_source_binding(
    result: ExtractionResult,
    company: Company,
    source_url: str,
    source_type: SourceType,
    signal_type: SignalType,
) -> None:
    if (
        result.vendor_id != company.id
        or result.signal_type != signal_type
        or result.source_url != source_url
        or result.source_type != source_type
    ):
        raise ValueError("Extraction result does not match the requested vendor source and template.")


def _no_evidence_item(
    company: Company,
    scan: Scan,
    source_text: str,
    source_url: str,
    source_type: SourceType,
    snapshot_path: str | Path,
    signal_type: SignalType,
    captured_at: datetime,
) -> EvidenceItem:
    return EvidenceItem(
        scan_id=scan.id,
        company_id=company.id,
        signal_type=signal_type,
        claim=f"No {signal_type.replace('_', ' ')} evidence extracted from this captured public source.",
        supporting_quote="",
        source_url=source_url,
        source_type=source_type,
        published_or_captured_at=captured_at,
        severity_hint="low",
        confidence=0,
        recommended_action="No escalation; retain the captured source for the review record.",
        support_status="no_evidence",
        snapshot_path=str(snapshot_path),
        source_excerpt=source_excerpt(source_text, ""),
        created_at=utc_now(),
    )


def _failed_source_item(
    company: Company,
    scan: Scan,
    source_text: str,
    source_url: str,
    source_type: SourceType,
    snapshot_path: str | Path,
    signal_type: SignalType,
    captured_at: datetime,
) -> EvidenceItem:
    return EvidenceItem(
        scan_id=scan.id,
        company_id=company.id,
        signal_type=signal_type,
        claim="Structured extraction failed for this captured public source.",
        supporting_quote="",
        source_url=source_url,
        source_type=source_type,
        published_or_captured_at=captured_at,
        severity_hint="low",
        confidence=0,
        recommended_action="Review the captured source manually before creating an alert.",
        support_status="failed_source",
        snapshot_path=str(snapshot_path),
        source_excerpt=source_excerpt(source_text, ""),
        created_at=utc_now(),
    )


def _extraction_prompt(
    *,
    company: Company,
    source_text: str,
    source_url: str,
    source_type: SourceType,
    signal_type: SignalType,
    captured_at: datetime,
    simpler: bool,
) -> str:
    no_evidence_json = (
        '{"vendor_id":"%s","signal_type":"%s","source_url":"%s","source_type":"%s",'
        '"support_status":"no_evidence","reason":"No supported signal in source."}'
        % (company.id, signal_type, source_url, source_type)
    )
    evidence_json = (
        '{"vendor_id":"%s","signal_type":"%s","claim":"...","supporting_quote":"exact source quote",'
        '"source_url":"%s","source_type":"%s","published_or_captured_at":"%s",'
        '"severity_hint":"low|medium|high","confidence":0.0,"recommended_action":"..."}'
        % (company.id, signal_type, source_url, source_type, captured_at.isoformat())
    )
    instruction = (
        "Retry: output JSON only with exactly one of the two schemas below."
        if simpler
        else TEMPLATE_GUIDANCE[signal_type] + " Output JSON only with exactly one of the two schemas below."
    )
    return (
        f"{instruction}\nEvidence schema: {evidence_json}\nNo-evidence schema: {no_evidence_json}\n"
        f"Vendor: {company.name} ({company.id})\nPublic source URL: {source_url}\n"
        f"Captured source text:\n{source_text[:MAX_SOURCE_CHARACTERS]}"
    )
