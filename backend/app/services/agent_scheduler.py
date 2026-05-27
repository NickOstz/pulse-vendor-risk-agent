import asyncio
import logging

from sqlmodel import Session, select

from app.config import get_settings
from app.models import Company, Scan, utc_now
from app.services.review_runner import ReviewRunner

logger = logging.getLogger(__name__)


class AgentScheduler:
    def __init__(self, runner: ReviewRunner | None = None) -> None:
        self.runner = runner or ReviewRunner()

    def due_companies(self, session: Session) -> list[Company]:
        now = utc_now()
        return list(
            session.exec(
                select(Company).where(
                    Company.agent_enabled == True,  # noqa: E712
                    Company.next_agent_run_at != None,  # noqa: E711
                    Company.next_agent_run_at <= now,
                )
            )
        )

    def active_runs(self, session: Session) -> list[Scan]:
        return list(session.exec(select(Scan).where(Scan.status.in_(["queued", "running"]))))

    def tick(self, session: Session) -> list[Scan]:
        started: list[Scan] = []
        active_company_ids = {scan.company_id for scan in self.active_runs(session)}
        for company in self.due_companies(session):
            if company.id in active_company_ids:
                continue
            scan = Scan(
                company_id=company.id,
                status="running",
                mode=self.runner.scan_mode(company),
                current_stage="collect",
            )
            company.agent_status = "running"
            session.add(scan)
            session.add(company)
            session.commit()
            session.refresh(scan)
            session.refresh(company)
            self.runner.start(session, company, scan)
            session.refresh(scan)
            session.refresh(company)
            started.append(scan)
        return started

    def advance_active_runs(self, session: Session) -> None:
        for scan in self.active_runs(session):
            company = session.get(Company, scan.company_id)
            if company is not None:
                self.runner.advance(session, company, scan)

    def cycle(self, session: Session) -> list[Scan]:
        started = self.tick(session)
        self.advance_active_runs(session)
        return started


scheduler = AgentScheduler()


async def run_scheduler_loop() -> None:
    from app.db import engine

    interval_seconds = max(1.0, get_settings().autonomous_scheduler_interval_seconds)
    while True:
        await asyncio.to_thread(_run_scheduler_cycle, engine)
        await asyncio.sleep(interval_seconds)


def _run_scheduler_cycle(engine: object) -> None:
    try:
        with Session(engine) as session:
            scheduler.cycle(session)
    except Exception:
        logger.exception("Autonomous scheduler cycle failed.")
