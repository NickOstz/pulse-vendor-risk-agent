from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.db import get_session
from app.models import BrightDataTrace
from app.schemas import TraceRead

router = APIRouter(prefix="/api/brightdata", tags=["brightdata"])


@router.get("/traces", response_model=list[TraceRead])
def list_traces(
    scan_id: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> list[BrightDataTrace]:
    statement = select(BrightDataTrace)
    if scan_id:
        statement = statement.where(BrightDataTrace.scan_id == scan_id)
    return list(session.exec(statement.order_by(BrightDataTrace.created_at.desc())).all())
