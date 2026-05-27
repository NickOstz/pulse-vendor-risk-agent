import json
from datetime import UTC, datetime

import httpx
import pytest

from app.models import Company, Scan
from app.services.extraction import (
    MAX_LLM_CALLS_PER_REVIEW,
    DeepSeekExtractionClient,
    extract_source,
)
from app.services.scoring import build_live_compliance_alert, calculate_signal_score


CAPTURED_AT = datetime(2026, 5, 26, 8, 0, tzinfo=UTC)
SOURCE_URL = "https://www.cloudflare.com/trust-hub/"
SOURCE_TEXT = "Public record states SOC 2 Type II assurance and Enterprise-only paid add-on terms."


class FakeExtractionClient:
    def __init__(self, responses: list[str]) -> None:
        self.responses = responses
        self.prompts: list[str] = []

    def complete_json(self, prompt: str) -> str:
        self.prompts.append(prompt)
        return self.responses[len(self.prompts) - 1]


def _company() -> Company:
    return Company(
        id="vendor-cloudflare-demo",
        name="Cloudflare",
        domain="cloudflare.com",
        relationship_type="edge security",
        owner="Security",
        criticality="critical",
        renewal_date=CAPTURED_AT.date(),
    )


def _scan(llm_calls_used: int = 0) -> Scan:
    return Scan(id="scan-structured-extraction", company_id="vendor-cloudflare-demo", llm_calls_used=llm_calls_used)


def _candidate(signal_type: str, quote: str = "SOC 2 Type II assurance") -> str:
    return json.dumps(
        {
            "vendor_id": "vendor-cloudflare-demo",
            "signal_type": signal_type,
            "claim": "A public source includes a review-relevant signal.",
            "supporting_quote": quote,
            "source_url": SOURCE_URL,
            "source_type": "vendor_owned",
            "published_or_captured_at": CAPTURED_AT.isoformat(),
            "severity_hint": "medium",
            "confidence": 0.91,
            "recommended_action": "Review the verified public-source signal.",
        }
    )


@pytest.mark.parametrize("signal_type", ["trust_security", "adverse_media", "pricing_terms"])
def test_structured_extraction_supports_each_mvp_signal_template(signal_type: str) -> None:
    scan = _scan()
    quote = (
        "A public incident affected the vendor and required customer review."
        if signal_type == "adverse_media"
        else "SOC 2 Type II assurance"
    )
    source_text = f"{SOURCE_TEXT} {quote}"

    evidence = extract_source(
        company=_company(),
        scan=scan,
        source_text=source_text,
        source_url=SOURCE_URL,
        source_type="vendor_owned",
        snapshot_path="captured.md",
        signal_type=signal_type,
        client=FakeExtractionClient([_candidate(signal_type, quote)]),
        captured_at=CAPTURED_AT,
    )

    assert evidence.signal_type == signal_type
    assert evidence.support_status == "verified"
    assert evidence.quote_match_score == 1.0
    assert scan.llm_calls_used == 1


def test_malformed_json_is_retried_once_with_simpler_prompt() -> None:
    scan = _scan()
    client = FakeExtractionClient(["not-json", _candidate("trust_security")])

    evidence = extract_source(
        company=_company(),
        scan=scan,
        source_text=SOURCE_TEXT,
        source_url=SOURCE_URL,
        source_type="vendor_owned",
        snapshot_path="captured.md",
        signal_type="trust_security",
        client=client,
        captured_at=CAPTURED_AT,
    )

    assert evidence.support_status == "verified"
    assert scan.llm_calls_used == 2
    assert len(client.prompts) == 2
    assert client.prompts[1].startswith("Retry: output JSON only")


def test_adverse_media_prompt_excludes_routine_security_guidance() -> None:
    scan = _scan()
    no_evidence = json.dumps(
        {
            "vendor_id": "vendor-cloudflare-demo",
            "signal_type": "adverse_media",
            "source_url": SOURCE_URL,
            "source_type": "vendor_owned",
            "support_status": "no_evidence",
            "reason": "The source is routine security guidance, not a negative vendor event.",
        }
    )
    client = FakeExtractionClient([no_evidence])

    evidence = extract_source(
        company=_company(),
        scan=scan,
        source_text="We conduct regular penetration testing through certified third-party assessors.",
        source_url=SOURCE_URL,
        source_type="vendor_owned",
        snapshot_path="captured.md",
        signal_type="adverse_media",
        client=client,
        captured_at=CAPTURED_AT,
    )

    prompt = client.prompts[0]
    assert evidence.support_status == "no_evidence"
    assert "routine security guidance" in prompt
    assert "Do not treat routine security guidance" in prompt
    assert "real negative event" in prompt


def test_extraction_prompt_requires_short_verbatim_quote() -> None:
    scan = _scan()
    client = FakeExtractionClient([_candidate("trust_security")])

    extract_source(
        company=_company(),
        scan=scan,
        source_text=SOURCE_TEXT,
        source_url=SOURCE_URL,
        source_type="vendor_owned",
        snapshot_path="captured.md",
        signal_type="trust_security",
        client=client,
        captured_at=CAPTURED_AT,
    )

    prompt = client.prompts[0]
    assert "short verbatim span" in prompt
    assert "under 35 words" in prompt
    assert "Do not stitch together separate sentences" in prompt


def test_adverse_media_title_only_quote_is_stored_as_no_evidence() -> None:
    scan = _scan()
    source_text = (
        "# Resolved Security Vulnerability\n\n"
        "We became aware of an individual who claimed he had discovered a vulnerability "
        "that allowed access to some Lemon Squeezy user data."
    )

    evidence = extract_source(
        company=_company(),
        scan=scan,
        source_text=source_text,
        source_url=SOURCE_URL,
        source_type="vendor_owned",
        snapshot_path="captured.md",
        signal_type="adverse_media",
        client=FakeExtractionClient(
            [
                _candidate("adverse_media", quote="Resolved Security Vulnerability"),
                _candidate("adverse_media", quote="Resolved Security Vulnerability"),
            ]
        ),
        captured_at=CAPTURED_AT,
    )

    assert evidence.support_status == "no_evidence"
    assert evidence.supporting_quote == ""
    assert evidence.quote_match_score is None


def test_adverse_media_headline_quote_is_retried_as_no_evidence() -> None:
    scan = _scan()
    headline = "The Vercel Breach: OAuth Supply Chain Attack Exposes the Hidden Risk in Platform Environment Variables"
    source_text = (
        f"{headline} | Trend Micro (US)\n\n"
        "Business\n\n"
        "The article navigation appears here before the body content."
    )
    no_evidence = json.dumps(
        {
            "vendor_id": "vendor-cloudflare-demo",
            "signal_type": "adverse_media",
            "source_url": SOURCE_URL,
            "source_type": "vendor_owned",
            "support_status": "no_evidence",
            "reason": "The captured text only provides a headline, not a body sentence supporting the event.",
        }
    )

    client = FakeExtractionClient([_candidate("adverse_media", quote=headline), no_evidence])

    evidence = extract_source(
        company=_company(),
        scan=scan,
        source_text=source_text,
        source_url=SOURCE_URL,
        source_type="vendor_owned",
        snapshot_path="captured.md",
        signal_type="adverse_media",
        client=client,
        captured_at=CAPTURED_AT,
    )

    assert evidence.support_status == "no_evidence"
    assert scan.llm_calls_used == 2
    assert "only a title/headline matches" in client.prompts[1]


def test_second_invalid_extraction_stores_failed_source_and_cannot_score() -> None:
    scan = _scan()
    client = FakeExtractionClient(
        [
            _candidate("trust_security").replace("vendor-cloudflare-demo", "wrong-vendor"),
            '{"unsupported": true}',
        ]
    )

    evidence = extract_source(
        company=_company(),
        scan=scan,
        source_text=SOURCE_TEXT,
        source_url=SOURCE_URL,
        source_type="vendor_owned",
        snapshot_path="captures/trust-hub.md",
        signal_type="trust_security",
        client=client,
        captured_at=CAPTURED_AT,
    )
    score, factors = calculate_signal_score(evidence, _company(), captured_at=CAPTURED_AT)
    alert = build_live_compliance_alert(_company(), scan, evidence)

    assert evidence.support_status == "failed_source"
    assert evidence.snapshot_path == "captures/trust-hub.md"
    assert evidence.source_excerpt == SOURCE_TEXT
    assert evidence.supporting_quote == ""
    assert scan.llm_calls_used == 2
    assert score == 0
    assert factors == {}
    assert alert is None


def test_explicit_no_evidence_result_is_stored_without_score() -> None:
    scan = _scan()
    no_evidence = json.dumps(
        {
            "vendor_id": "vendor-cloudflare-demo",
            "signal_type": "adverse_media",
            "source_url": SOURCE_URL,
            "source_type": "vendor_owned",
            "support_status": "no_evidence",
            "reason": "No public incident evidence appears in this source.",
        }
    )

    evidence = extract_source(
        company=_company(),
        scan=scan,
        source_text=SOURCE_TEXT,
        source_url=SOURCE_URL,
        source_type="vendor_owned",
        snapshot_path="captured.md",
        signal_type="adverse_media",
        client=FakeExtractionClient([no_evidence]),
        captured_at=CAPTURED_AT,
    )
    score, _ = calculate_signal_score(evidence, _company(), captured_at=CAPTURED_AT)

    assert evidence.support_status == "no_evidence"
    assert evidence.quote_match_score is None
    assert scan.llm_calls_used == 1
    assert score == 0


def test_retry_never_exceeds_per_review_llm_call_budget() -> None:
    scan = _scan(llm_calls_used=MAX_LLM_CALLS_PER_REVIEW - 1)
    client = FakeExtractionClient(["not-json"])

    evidence = extract_source(
        company=_company(),
        scan=scan,
        source_text=SOURCE_TEXT,
        source_url=SOURCE_URL,
        source_type="vendor_owned",
        snapshot_path="captured.md",
        signal_type="trust_security",
        client=client,
        captured_at=CAPTURED_AT,
    )

    assert evidence.support_status == "failed_source"
    assert scan.llm_calls_used == MAX_LLM_CALLS_PER_REVIEW
    assert len(client.prompts) == 1


def test_deepseek_client_requests_json_output(monkeypatch) -> None:
    captured: dict = {}

    def fake_post(url, *, headers, json, timeout):
        captured.update({"url": url, "headers": headers, "payload": json, "timeout": timeout})
        return httpx.Response(
            200,
            request=httpx.Request("POST", url),
            json={"choices": [{"message": {"content": '{"support_status":"no_evidence"}'}}]},
        )

    monkeypatch.setattr("app.services.extraction.httpx.post", fake_post)
    client = DeepSeekExtractionClient(
        api_key="local-test-key",
        endpoint="https://api.deepseek.com/chat/completions",
        model="deepseek-v4-flash",
        timeout_seconds=12,
    )

    result = client.complete_json("Return json.")

    assert result == '{"support_status":"no_evidence"}'
    assert captured["headers"]["Authorization"] == "Bearer local-test-key"
    assert captured["payload"]["model"] == "deepseek-v4-flash"
    assert captured["payload"]["response_format"] == {"type": "json_object"}
    assert captured["timeout"] == 12
