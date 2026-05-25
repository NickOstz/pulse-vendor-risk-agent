from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.db import get_session
from app.models import Company, Scan
from app.schemas import ManualScanRequest, ScanRead
from app.services.review_runner import ReviewRunner
from app.services.serializers import scan_to_read

router = APIRouter(prefix="/api/scans", tags=["scans"])


@router.post("/run", response_model=ScanRead)
def run_scan(payload: ManualScanRequest, session: Session = Depends(get_session)) -> ScanRead:
    company = session.get(Company, payload.company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="company not found")
    scan = Scan(company_id=company.id, status="running", mode="replay", current_stage="collect")
    company.agent_status = "running"
    session.add(scan)
    session.add(company)
    session.commit()
    session.refresh(scan)
    session.refresh(company)
    ReviewRunner().start(session, company, scan)
    session.refresh(scan)
    return scan_to_read(scan)


@router.get("/{scan_id}", response_model=ScanRead)
def get_scan(scan_id: str, session: Session = Depends(get_session)) -> ScanRead:
    scan = session.get(Scan, scan_id)
    if scan is None:
        raise HTTPException(status_code=404, detail="scan not found")
    response = scan_to_read(scan)
    if scan.status == "running" and scan.mode == "replay":
        company = session.get(Company, scan.company_id)
        if company is not None:
            ReviewRunner().advance(session, company, scan)
    return response
