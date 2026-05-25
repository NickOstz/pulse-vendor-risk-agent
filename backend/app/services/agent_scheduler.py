from sqlmodel import Session, select

from app.models import Company, Scan, utc_now
from app.services.review_runner import ReviewRunner


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
            scan = Scan(company_id=company.id, status="running", mode="replay", current_stage="collect")
            company.agent_status = "running"
            session.add(scan)
            session.add(company)
            session.commit()
            session.refresh(scan)
            session.refresh(company)
            started.append(scan)
            self.runner.run(session, company, scan)
        return started


scheduler = AgentScheduler()
