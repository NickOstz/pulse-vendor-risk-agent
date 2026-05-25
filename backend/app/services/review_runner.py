from sqlmodel import Session

from app.config import get_settings
from app.models import Company, Scan
from app.services.brightdata_client import BrightDataClient
from app.services.live_collection import record_live_collection_attempt
from app.services.replay_loader import advance_replay_scan, prepare_replay_scan


class ReviewRunner:
    """Live-proof plus replay-safe runner for backend/frontend integration."""

    def scan_mode(self) -> str:
        settings = get_settings()
        if settings.default_review_mode == "live_with_fallback" and BrightDataClient(settings).serp_configured:
            return "live_with_fallback"
        return "replay"

    def start(self, session: Session, company: Company, scan: Scan) -> None:
        prepare_replay_scan(session, company, scan)

    def advance(self, session: Session, company: Company, scan: Scan) -> None:
        if scan.mode == "live_with_fallback" and scan.current_stage == "collect":
            record_live_collection_attempt(session, company, scan)
        advance_replay_scan(session, company, scan)
