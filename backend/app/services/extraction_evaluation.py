from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.config import get_settings
from app.models import Company, Scan
from app.services.extraction import (
    DeepSeekExtractionClient,
    ExtractedEvidence,
    SignalType,
    SourceType,
    StructuredExtractionClient,
    extract_source,
)


QUALITY_GATE_MIN_VERIFIED = 4


class EvaluationCase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    signal_type: SignalType
    source_url: str = Field(min_length=1)
    source_type: SourceType
    source_text: str = Field(min_length=1)
    expected_response: ExtractedEvidence


class EvaluationSet(BaseModel):
    model_config = ConfigDict(extra="forbid")

    description: str = Field(min_length=1)
    verified_on: str = Field(min_length=1)
    cases: list[EvaluationCase] = Field(min_length=5, max_length=5)


class RecordedExtractionClient:
    def __init__(self, response: ExtractedEvidence) -> None:
        self.response = response

    def complete_json(self, prompt: str) -> str:
        return self.response.model_dump_json()


def load_evaluation_set() -> EvaluationSet:
    path = get_settings().replay_dir / "extraction_evaluation.json"
    return EvaluationSet.model_validate_json(path.read_text(encoding="utf-8"))


def run_extraction_evaluation(
    mode: Literal["recorded_baseline", "deepseek"] = "recorded_baseline",
    client: StructuredExtractionClient | None = None,
) -> dict[str, object]:
    evaluation_set = load_evaluation_set()
    shared_client = client or _configured_client(mode)
    company = _evaluation_company()
    scan = Scan(id="evaluation-scan", company_id=company.id)
    results: list[dict[str, object]] = []
    per_template: dict[str, list[bool]] = defaultdict(list)

    for case in evaluation_set.cases:
        case_client = (
            RecordedExtractionClient(case.expected_response)
            if mode == "recorded_baseline" and client is None
            else shared_client
        )
        if case_client is None:
            raise ValueError("An extraction client is required for a non-recorded evaluation.")
        evidence = extract_source(
            company=company,
            scan=scan,
            source_text=case.source_text,
            source_url=case.source_url,
            source_type=case.source_type,
            snapshot_path=Path("evaluation") / f"{case.id}.md",
            signal_type=case.signal_type,
            client=case_client,
        )
        passed = evidence.support_status == "verified" and (evidence.quote_match_score or 0) >= 0.8
        per_template[case.signal_type].append(passed)
        results.append(
            {
                "case_id": case.id,
                "signal_type": case.signal_type,
                "source_url": case.source_url,
                "support_status": evidence.support_status,
                "quote_match_score": evidence.quote_match_score,
                "passed": passed,
            }
        )

    verified_pages = sum(bool(result["passed"]) for result in results)
    template_results = {
        template: {
            "passed": sum(values),
            "total": len(values),
            "pass_rate": round(sum(values) / len(values), 4),
        }
        for template, values in sorted(per_template.items())
    }
    quality_gate_passed = verified_pages >= QUALITY_GATE_MIN_VERIFIED
    return {
        "mode": mode,
        "verified_on": evaluation_set.verified_on,
        "pages_total": len(results),
        "verified_pages": verified_pages,
        "required_verified_pages": QUALITY_GATE_MIN_VERIFIED,
        "quality_gate_passed": quality_gate_passed,
        "llm_calls_used": scan.llm_calls_used,
        "by_template": template_results,
        "best_two_templates_if_gate_fails": (
            [] if quality_gate_passed else _best_two_templates(template_results)
        ),
        "cases": results,
    }


def _configured_client(mode: str) -> StructuredExtractionClient | None:
    if mode == "recorded_baseline":
        return None
    settings = get_settings()
    if not settings.deepseek_api_key:
        raise ValueError("DeepSeek evaluation requires DEEPSEEK_API_KEY in the local backend environment.")
    return DeepSeekExtractionClient(
        api_key=settings.deepseek_api_key,
        endpoint=settings.deepseek_api_endpoint,
        model=settings.deepseek_extraction_model,
        timeout_seconds=settings.llm_extraction_timeout_seconds,
    )


def _best_two_templates(template_results: dict[str, dict[str, float | int]]) -> list[str]:
    return [
        name
        for name, _ in sorted(
            template_results.items(),
            key=lambda item: (-float(item[1]["pass_rate"]), item[0]),
        )[:2]
    ]


def _evaluation_company() -> Company:
    return Company(
        id="vendor-cloudflare-demo",
        name="Cloudflare",
        domain="cloudflare.com",
        relationship_type="edge security",
        owner="Security",
        criticality="critical",
        renewal_date=date(2026, 7, 10),
    )
