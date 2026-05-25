from sqlmodel import Session

from app.models import Company, Scan
from app.services.replay_loader import load_replay_review


class ReviewRunner:
    """Temporary replay-backed review runner for backend/frontend integration."""

    def run(self, session: Session, company: Company, scan: Scan) -> None:
        load_replay_review(session, company, scan)
