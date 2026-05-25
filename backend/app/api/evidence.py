from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db import get_session
from app.models import Company, EvidenceItem
from app.schemas import EvidenceRead

router = APIRouter(prefix="/api/companies", tags=["evidence"])


@router.get("/{company_id}/evidence", response_model=list[EvidenceRead])
def list_evidence(
    company_id: str,
    scan_id: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> list[EvidenceItem]:
    if session.get(Company, company_id) is None:
        raise HTTPException(status_code=404, detail="company not found")
    statement = select(EvidenceItem).where(EvidenceItem.company_id == company_id)
    if scan_id:
        statement = statement.where(EvidenceItem.scan_id == scan_id)
    return list(session.exec(statement.order_by(EvidenceItem.created_at.desc())).all())
