from __future__ import annotations

from datetime import datetime
import os
from pathlib import Path
import re
import subprocess
from typing import Literal, Protocol

import httpx
from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, ValidationError

from app.config import Settings
from app.models import Company, EvidenceItem, Scan, utc_now
from app.services.verification import verify_quote


MAX_LLM_CALLS_PER_REVIEW = 20
MAX_SOURCE_CHARACTERS = 12000
SignalType = Literal["trust_security", "adverse_media", "pricing_terms"]
SourceType = Literal["vendor_owned", "news", "regulator", "general_web"]

TEMPLATE_GUIDANCE: dict[SignalType, str] = {
    "trust_security": (
        "Look only for public trust, security, privacy, certification, compliance, assurance, "
        "or security-process evidence. Normal vendor-authored security guidance belongs here, not adverse_media."
    ),
    "adverse_media": (
        "Look only for a real negative event involving this vendor: incident, outage, breach, compromise, "
        "lawsuit, regulator action, enforcement action, or customer-impacting security failure. "
        "Do not treat routine security guidance, penetration-testing documentation, compliance pages, "
        "marketing claims, or hypothetical risk language as adverse media."
    ),
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


class ChatCompletionExtractionClient:
    """Small JSON-mode client for OpenAI-compatible chat-completions providers."""

    def __init__(
        self,
        *,
        api_key: str,
        endpoint: str,
        model: str,
        timeout_seconds: float,
        provider_name: str,
        include_thinking_disabled: bool = False,
    ) -> None:
        self.api_key = api_key
        self.endpoint = endpoint
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.provider_name = provider_name
        self.include_thinking_disabled = include_thinking_disabled

    def complete_json(self, prompt: str) -> str:
        payload = {
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
            "temperature": 0,
            "max_tokens": 700,
        }
        if self.include_thinking_disabled:
            payload["thinking"] = {"type": "disabled"}

        try:
            response = httpx.post(
                self.endpoint,
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                json=payload,
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
        except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
            raise ExtractionClientError(f"{self.provider_name} structured extraction request failed.") from exc
        if not isinstance(content, str) or not content.strip():
            raise ExtractionClientError(f"{self.provider_name} structured extraction returned empty content.")
        return content


class AIMLAPIExtractionClient(ChatCompletionExtractionClient):
    def __init__(self, api_key: str, endpoint: str, model: str, timeout_seconds: float) -> None:
        super().__init__(
            api_key=api_key,
            endpoint=endpoint,
            model=model,
            timeout_seconds=timeout_seconds,
            provider_name="AI/ML API",
        )


class DeepSeekExtractionClient(ChatCompletionExtractionClient):
    def __init__(self, api_key: str, endpoint: str, model: str, timeout_seconds: float) -> None:
        super().__init__(
            api_key=api_key,
            endpoint=endpoint,
            model=model,
            timeout_seconds=timeout_seconds,
            provider_name="DeepSeek",
            include_thinking_disabled=True,
        )


class KiroExtractionClient:
    """Last-resort Kiro CLI client for headless structured extraction."""

    def __init__(self, api_key: str, cli_path: str, timeout_seconds: float) -> None:
        self.api_key = api_key
        self.cli_path = cli_path
        self.timeout_seconds = timeout_seconds

    def complete_json(self, prompt: str) -> str:
        kiro_prompt = (
            "You extract public vendor-risk evidence. Return only one JSON object that matches the requested "
            "schema. Never infer a quote that is absent from the source.\n\n"
            f"{prompt}"
        )
        env = os.environ.copy()
        env["KIRO_API_KEY"] = self.api_key
        try:
            completed = subprocess.run(
                [self.cli_path, "chat", "--no-interactive", kiro_prompt],
                capture_output=True,
                check=False,
                env=env,
                text=True,
                timeout=self.timeout_seconds,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise ExtractionClientError("Kiro structured extraction request failed.") from exc
        if completed.returncode != 0:
            raise ExtractionClientError("Kiro structured extraction request failed.")
        return _extract_json_object(completed.stdout)


class FallbackExtractionClient:
    def __init__(self, clients: list[StructuredExtractionClient]) -> None:
        self.clients = clients

    def complete_json(self, prompt: str) -> str:
        errors: list[str] = []
        for client in self.clients:
            try:
                return client.complete_json(prompt)
            except ExtractionClientError as exc:
                errors.append(str(exc))
        detail = "; ".join(errors) if errors else "No LLM providers are configured."
        raise ExtractionClientError(f"All configured LLM providers failed. {detail}")


def configured_extraction_client(settings: Settings) -> StructuredExtractionClient | None:
    if not settings.llm_extraction_enabled:
        return None

    clients: list[StructuredExtractionClient] = []
    if settings.aimlapi_api_key:
        clients.append(
            AIMLAPIExtractionClient(
                api_key=settings.aimlapi_api_key,
                endpoint=settings.aimlapi_api_endpoint,
                model=settings.aimlapi_extraction_model,
                timeout_seconds=settings.llm_extraction_timeout_seconds,
            )
        )
    if settings.deepseek_api_key:
        clients.append(
            DeepSeekExtractionClient(
                api_key=settings.deepseek_api_key,
                endpoint=settings.deepseek_api_endpoint,
                model=settings.deepseek_extraction_model,
                timeout_seconds=settings.llm_extraction_timeout_seconds,
            )
        )
    if settings.kiro_api_key:
        clients.append(
            KiroExtractionClient(
                api_key=settings.kiro_api_key,
                cli_path=settings.kiro_cli_path,
                timeout_seconds=settings.llm_extraction_timeout_seconds,
            )
        )
    if not clients:
        return None
    if len(clients) == 1:
        return clients[0]
    return FallbackExtractionClient(clients)


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
        if _unsupported_adverse_quote(result, source_text):
            if not simpler_prompt:
                continue
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
    if support_status == "verified" and _unsupported_adverse_quote(candidate, source_text):
        support_status = "needs_review"
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


def _unsupported_adverse_quote(candidate: ExtractedEvidence, source_text: str) -> bool:
    if candidate.signal_type != "adverse_media":
        return False
    words = re.findall(r"[A-Za-z0-9]+", candidate.supporting_quote)
    if len(words) < 8:
        return True
    quote = candidate.supporting_quote.strip()
    if quote and not re.search(r"[.!?][\"')\]]?$", quote):
        return True
    return _quote_looks_like_title_or_heading(source_text, quote)


def _quote_looks_like_title_or_heading(source_text: str, quote: str) -> bool:
    if not quote:
        return False
    start = source_text.casefold().find(quote.casefold())
    if start < 0:
        return False
    line_start = source_text.rfind("\n", 0, start) + 1
    line_end = source_text.find("\n", start)
    if line_end < 0:
        line_end = len(source_text)
    line = source_text[line_start:line_end].strip()
    cleaned_line = re.sub(r"^[#>*\-\s]+", "", line)
    if line.startswith("#") and quote.casefold() in cleaned_line.casefold():
        return True
    quote_has_sentence_end = bool(re.search(r"[.!?][\"')\]]?$", quote))
    return cleaned_line.casefold().startswith(quote.casefold()) and (
        "|" in cleaned_line or (not quote_has_sentence_end and len(cleaned_line) <= len(quote) + 80)
    )


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
        "Retry: output JSON only with exactly one of the two schemas below. "
        "Use a short verbatim quote copied from the captured text."
        if simpler
        else (
            TEMPLATE_GUIDANCE[signal_type]
            + " Output JSON only with exactly one of the two schemas below. "
            "If this page does not match the requested signal type, return the no-evidence schema. "
            "The supporting_quote must be a short verbatim span copied from the captured source text, "
            "preferably under 35 words. Do not stitch together separate sentences or summarize. "
            "Do not include navigation text, page titles, markdown image syntax, or unrelated boilerplate in the quote. "
            "For adverse_media, the quote must be a substantive body sentence that describes what happened, "
            "who/what was affected, or how the issue was remediated; never use only a headline or title. "
            "If the only matching adverse-media text is a page title or headline, return no_evidence."
        )
    )
    if simpler and signal_type == "adverse_media":
        instruction += (
            " For adverse_media, use a complete body sentence ending in punctuation; "
            "if only a title/headline matches, return no_evidence."
        )
    return (
        f"{instruction}\nEvidence schema: {evidence_json}\nNo-evidence schema: {no_evidence_json}\n"
        f"Vendor: {company.name} ({company.id})\nPublic source URL: {source_url}\n"
        f"Captured source text:\n{source_text[:MAX_SOURCE_CHARACTERS]}"
    )


def _extract_json_object(content: str) -> str:
    stripped = content.strip()
    if stripped.startswith("{") and stripped.endswith("}"):
        return stripped

    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", stripped, flags=re.DOTALL | re.IGNORECASE)
    if fenced:
        return fenced.group(1).strip()

    start = stripped.find("{")
    end = stripped.rfind("}")
    if start >= 0 and end > start:
        return stripped[start : end + 1].strip()
    raise ExtractionClientError("Kiro structured extraction returned no JSON object.")
