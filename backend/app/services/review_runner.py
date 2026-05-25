from sqlmodel import Session

from app.models import Company, Scan
from app.services.replay_loader import advance_replay_scan, prepare_replay_scan


class ReviewRunner:
    """Temporary replay-backed review runner for backend/frontend integration."""

    def start(self, session: Session, company: Company, scan: Scan) -> None:
        prepare_replay_scan(session, company, scan)

    def advance(self, session: Session, company: Company, scan: Scan) -> None:
        advance_replay_scan(session, company, scan)
