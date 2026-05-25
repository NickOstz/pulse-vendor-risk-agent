from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import Brief
from app.schemas import BriefRead, BriefRequest

router = APIRouter(prefix="/api/briefs", tags=["briefs"])


@router.post("/vendor-review", response_model=BriefRead)
def vendor_review_brief(payload: BriefRequest, session: Session = Depends(get_session)) -> BriefRead:
    brief = session.exec(
        select(Brief).where(Brief.company_id == payload.company_id, Brief.scan_id == payload.scan_id)
    ).first()
    if brief is None:
        raise HTTPException(status_code=404, detail="brief not found for company and scan")
    content = brief.markdown if payload.format == "markdown" else brief.html
    return BriefRead(company_id=payload.company_id, scan_id=payload.scan_id, format=payload.format, content=content)
