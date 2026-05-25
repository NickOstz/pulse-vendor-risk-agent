from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.db import get_session
from app.schemas import ActiveRun, AgentStatusRead, AgentTickRead
from app.services.agent_scheduler import scheduler
from app.services.serializers import company_to_read

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("/status", response_model=AgentStatusRead)
def agent_status(session: Session = Depends(get_session)) -> AgentStatusRead:
    active_runs = [
        ActiveRun(company_id=scan.company_id, scan_id=scan.id, current_stage=scan.current_stage)
        for scan in scheduler.active_runs(session)
    ]
    due_vendors = [company_to_read(company) for company in scheduler.due_companies(session)]
    return AgentStatusRead(active_runs=active_runs, due_vendors=due_vendors)


@router.post("/tick", response_model=AgentTickRead)
def tick_agents(session: Session = Depends(get_session)) -> AgentTickRead:
    due_vendors = scheduler.due_companies(session)
    scans = scheduler.tick(session)
    return AgentTickRead(
        started_scan_ids=[scan.id for scan in scans],
        due_vendor_ids=[company.id for company in due_vendors],
    )
