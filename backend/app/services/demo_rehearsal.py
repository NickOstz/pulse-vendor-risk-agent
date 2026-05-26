import os
import tempfile
import time
from collections import Counter
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterator, Literal

from fastapi.testclient import TestClient


DEMO_COMPANY_ID = "vendor-cloudflare-demo"
APPROVED_LIVE_SOURCE_URL = "https://www.cloudflare.com/trust-hub/"
TERMINAL_STATUSES = {"completed", "completed_with_fallback", "failed"}
EXPECTED_STAGES = ["collect", "extract", "verify", "score", "brief"]


class RehearsalError(RuntimeError):
    pass


@dataclass(frozen=True)
class RehearsalConfig:
    mode: Literal["replay", "live_with_fallback"] = "replay"
    poll_interval_seconds: float = 2.0
    timeout_seconds: float = 180.0


def run_demo_rehearsal(config: RehearsalConfig) -> dict[str, object]:
    if config.poll_interval_seconds < 0:
        raise ValueError("poll interval cannot be negative")
    if config.timeout_seconds <= 0:
        raise ValueError("timeout must be positive")

    started_at = time.perf_counter()
    with tempfile.TemporaryDirectory(prefix="pulse-demo-rehearsal-") as temp_dir:
        temp_path = Path(temp_dir)
        overrides = {
            "DATABASE_URL": f"sqlite:///{(temp_path / 'pulse-rehearsal.db').as_posix()}",
            "DEFAULT_REVIEW_MODE": config.mode,
            "BRIGHTDATA_LIVE_SNAPSHOT_DIR": str(temp_path / "live-snapshots"),
        }
        if config.mode == "replay":
            overrides.update(
                {
                    "BRIGHTDATA_API_KEY": "",
                    "BRIGHTDATA_SERP_ZONE": "",
                    "BRIGHTDATA_UNLOCKER_ZONE": "",
                    "BRIGHTDATA_DEMO_SOURCE_URL": "",
                }
            )

        with _temporary_environment(overrides):
            client, restore_db = _create_disposable_client()
            try:
                with client:
                    report = _exercise_demo_flow(client, config, started_at)
            finally:
                restore_db()

    return report


def _exercise_demo_flow(client: TestClient, config: RehearsalConfig, started_at: float) -> dict[str, object]:
    health = _json_response(client.get("/api/health"), "read demo health")
    if config.mode == "live_with_fallback" and not health["brightdata_key_present"]:
        raise RehearsalError(
            "Live-with-fallback was requested, but no Bright Data API key is configured in the backend environment."
        )

    enabled = _json_response(
        client.patch(f"/api/companies/{DEMO_COMPANY_ID}/agent", json={"agent_enabled": True}),
        "enable Vendor Risk Agent",
    )
    if not enabled["agent_enabled"] or enabled["agent_status"] != "active":
        raise RehearsalError("The demo vendor did not enter the active agent state.")
    if not enabled["next_agent_run_at"]:
        raise RehearsalError("The demo vendor was not scheduled due now after enablement.")

    tick = _json_response(client.post("/api/agents/tick"), "start due autonomous review")
    scan_ids = tick["started_scan_ids"]
    if len(scan_ids) != 1:
        raise RehearsalError(f"Expected one due review cycle, received {len(scan_ids)}.")
    scan_id = scan_ids[0]

    scans = []
    while True:
        if time.perf_counter() - started_at >= config.timeout_seconds:
            raise RehearsalError("The autonomous review exceeded the rehearsal timeout.")
        scan = _json_response(client.get(f"/api/scans/{scan_id}"), "poll review status")
        scans.append(scan)
        if scan["status"] in TERMINAL_STATUSES:
            break
        if config.poll_interval_seconds:
            time.sleep(config.poll_interval_seconds)

    terminal = scans[-1]
    if terminal["status"] == "failed":
        raise RehearsalError("The autonomous review completed with a failure status.")
    if terminal["mode"] != config.mode:
        raise RehearsalError(
            f"Requested {config.mode} rehearsal but the review ran in {terminal['mode']} mode."
        )

    observed_stages = [scan["current_stage"] for scan in scans]
    for expected_stage in EXPECTED_STAGES:
        if expected_stage not in observed_stages:
            raise RehearsalError(f"The review never exposed the {expected_stage} stage.")

    evidence = _json_response(
        client.get(f"/api/companies/{DEMO_COMPANY_ID}/evidence?scan_id={scan_id}"),
        "read evidence",
    )
    alerts = _json_response(
        client.get(f"/api/alerts?company_id={DEMO_COMPANY_ID}&scan_id={scan_id}"),
        "read alerts",
    )
    traces = _json_response(
        client.get(f"/api/brightdata/traces?scan_id={scan_id}"),
        "read Bright Data traces",
    )
    markdown = _json_response(
        client.post(
            "/api/briefs/vendor-review",
            json={"company_id": DEMO_COMPANY_ID, "scan_id": scan_id, "format": "markdown"},
        ),
        "read Markdown brief",
    )
    html = _json_response(
        client.post(
            "/api/briefs/vendor-review",
            json={"company_id": DEMO_COMPANY_ID, "scan_id": scan_id, "format": "html"},
        ),
        "read HTML brief",
    )

    _verify_assessment_output(evidence, alerts, traces, markdown, html, config.mode)

    elapsed_seconds = round(time.perf_counter() - started_at, 2)
    if elapsed_seconds >= 180:
        raise RehearsalError("The completed rehearsal exceeded the three-minute demo target.")

    return {
        "mode": terminal["mode"],
        "status": terminal["status"],
        "elapsed_seconds": elapsed_seconds,
        "within_three_minutes": True,
        "stages_observed": observed_stages,
        "evidence_count": len(evidence),
        "verified_count": sum(item["support_status"] == "verified" for item in evidence),
        "high_priority_alerts_checked": sum(alert["severity"] == "high" for alert in alerts),
        "related_change_present": any(alert["alert_type"] == "related_change" for alert in alerts),
        "source_modes": dict(Counter(trace["source_mode"] for trace in traces)),
        "brief_formats_checked": ["markdown", "html"],
    }


def _verify_assessment_output(
    evidence: list[dict],
    alerts: list[dict],
    traces: list[dict],
    markdown: dict,
    html: dict,
    mode: str,
) -> None:
    evidence_by_id = {item["id"]: item for item in evidence}
    if not evidence:
        raise RehearsalError("No evidence items were returned for the completed review.")

    high_priority = [alert for alert in alerts if alert["severity"] == "high"]
    if not high_priority:
        raise RehearsalError("The completed review did not return a high-priority demo alert.")
    for alert in high_priority:
        linked_ids = (
            [alert["evidence_item_id"]]
            if alert["evidence_item_id"]
            else alert["related_evidence_ids"]
        )
        if not linked_ids:
            raise RehearsalError("A high-priority alert is missing linked evidence.")
        if any(
            evidence_by_id.get(evidence_id, {}).get("support_status") != "verified"
            for evidence_id in linked_ids
        ):
            raise RehearsalError("A high-priority alert references evidence that is not verified.")

    if not any(alert["alert_type"] == "related_change" for alert in alerts):
        raise RehearsalError("The demo review did not return its related-change card.")

    source_modes = {trace["source_mode"] for trace in traces}
    expected_mode = "cached" if mode == "replay" else "live"
    if expected_mode not in source_modes:
        raise RehearsalError(f"The completed review did not record a {expected_mode} trace.")
    if mode == "live_with_fallback" and "fallback" not in source_modes:
        raise RehearsalError("The live-with-fallback review did not label its fallback evidence.")
    if mode == "live_with_fallback" and not any(
        trace["product"] == "web_unlocker"
        and trace["source_mode"] == "live"
        and trace["source_url"] == APPROVED_LIVE_SOURCE_URL
        for trace in traces
    ):
        raise RehearsalError(
            "The live-with-fallback review did not attempt the approved Cloudflare Trust Hub source."
        )

    if "Vendor Risk Assessment Brief: Cloudflare" not in markdown["content"]:
        raise RehearsalError("The Markdown assessment brief was not returned.")
    if "<h1>Vendor Risk Assessment Brief: Cloudflare</h1>" not in html["content"]:
        raise RehearsalError("The HTML assessment brief was not returned.")


def _create_disposable_client() -> tuple[TestClient, Callable[[], None]]:
    from app.config import get_settings
    import app.db as db
    from app.main import create_app

    get_settings.cache_clear()
    prior_engine = db.engine
    db.engine = db.create_engine(
        os.environ["DATABASE_URL"],
        connect_args={"check_same_thread": False},
    )

    def restore_db() -> None:
        db.engine.dispose()
        db.engine = prior_engine
        get_settings.cache_clear()

    return TestClient(create_app()), restore_db


def _json_response(response, action: str):
    if response.status_code >= 400:
        raise RehearsalError(f"Could not {action}; API returned HTTP {response.status_code}.")
    return response.json()


@contextmanager
def _temporary_environment(overrides: dict[str, str]) -> Iterator[None]:
    previous = {name: os.environ.get(name) for name in overrides}
    try:
        os.environ.update(overrides)
        yield
    finally:
        for name, value in previous.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value
