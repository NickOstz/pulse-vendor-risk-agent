import json

from app.services.extraction_evaluation import run_extraction_evaluation


class SequencedClient:
    def __init__(self, responses: list[str]) -> None:
        self.responses = iter(responses)

    def complete_json(self, prompt: str) -> str:
        return next(self.responses)


def test_recorded_extraction_baseline_passes_five_page_quality_gate() -> None:
    report = run_extraction_evaluation()

    assert report["mode"] == "recorded_baseline"
    assert report["pages_total"] == 5
    assert report["verified_pages"] == 5
    assert report["quality_gate_passed"] is True
    assert report["llm_calls_used"] == 5
    assert set(report["by_template"]) == {"trust_security", "adverse_media", "pricing_terms"}
    assert report["best_two_templates_if_gate_fails"] == []


def test_failed_quality_gate_identifies_best_two_templates() -> None:
    passing_pricing = _response(
        "pricing_terms",
        "https://developers.cloudflare.com/data-localization/",
        "Enterprise-only paid add-on",
    )
    passing_adverse = _response(
        "adverse_media",
        "https://www.cloudflarestatus.com/uptime",
        "Increased HTTP 502 Errors in Buenos Aires. This incident has been resolved.",
    )
    client = SequencedClient(
        [
            "invalid",
            "invalid",
            "invalid",
            "invalid",
            passing_pricing,
            "invalid",
            "invalid",
            passing_adverse,
        ]
    )

    report = run_extraction_evaluation(mode="deepseek", client=client)

    assert report["verified_pages"] == 2
    assert report["quality_gate_passed"] is False
    assert report["llm_calls_used"] == 8
    assert report["best_two_templates_if_gate_fails"] == ["adverse_media", "pricing_terms"]


def _response(signal_type: str, source_url: str, quote: str) -> str:
    return json.dumps(
        {
            "vendor_id": "vendor-cloudflare-demo",
            "signal_type": signal_type,
            "claim": "A supported source-backed evaluation signal.",
            "supporting_quote": quote,
            "source_url": source_url,
            "source_type": "vendor_owned",
            "published_or_captured_at": "2026-05-26T00:00:00Z",
            "severity_hint": "medium",
            "confidence": 0.9,
            "recommended_action": "Review source-backed evidence.",
        }
    )
