from threading import Lock

from sqlmodel import Session

from app.config import get_settings
from app.models import Company, Scan
from app.services.brightdata_client import BrightDataClient
from app.services.live_collection import record_live_collection_attempt
from app.services.live_evidence import is_demo_company
from app.services.replay_loader import advance_replay_scan, prepare_replay_scan


_ADVANCE_LOCK = Lock()


class ReviewRunner:
    """Live-proof plus replay-safe runner for backend/frontend integration."""

    def scan_mode(self, company: Company) -> str:
        settings = get_settings()
        client = BrightDataClient(settings)
        if settings.default_review_mode != "live_with_fallback" or not client.serp_configured:
            return "replay"
        if is_demo_company(company):
            return "live_with_fallback"
        if (
            client.unlocker_configured
            and settings.llm_extraction_enabled
            and settings.deepseek_api_key
        ):
            return "live"
        return "replay"

    def start(self, session: Session, company: Company, scan: Scan) -> None:
        prepare_replay_scan(session, company, scan)

    def advance(self, session: Session, company: Company, scan: Scan) -> None:
        # One service replica may receive polls from several open dashboard tabs.
        # Refresh under a lock so only one request performs each provider-backed stage.
        with _ADVANCE_LOCK:
            session.refresh(scan)
            session.refresh(company)
            if scan.status != "running":
                return
            if scan.mode in {"live", "live_with_fallback"} and scan.current_stage == "collect":
                record_live_collection_attempt(session, company, scan)
            advance_replay_scan(session, company, scan)
