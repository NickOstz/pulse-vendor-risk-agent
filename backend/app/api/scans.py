from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db import get_session
from app.models import Company, Scan
from app.schemas import ManualScanRequest, ScanRead
from app.api.operator_access import operator_access_granted, require_operator_access
from app.services.review_runner import ReviewRunner
from app.services.serializers import scan_to_read

router = APIRouter(prefix="/api/scans", tags=["scans"])


@router.post("/run", response_model=ScanRead)
def run_scan(
    payload: ManualScanRequest,
    session: Session = Depends(get_session),
    _operator_access: None = Depends(require_operator_access),
) -> ScanRead:
    company = session.get(Company, payload.company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="company not found")
    # This endpoint is intentionally the replay-only recovery path for demos.
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


@router.get("/latest", response_model=ScanRead | None)
def get_latest_scan(
    company_id: str = Query(...),
    session: Session = Depends(get_session),
) -> ScanRead | None:
    if session.get(Company, company_id) is None:
        raise HTTPException(status_code=404, detail="company not found")
    scan = session.exec(
        select(Scan)
        .where(Scan.company_id == company_id)
        .order_by(Scan.started_at.desc())
    ).first()
    return scan_to_read(scan) if scan else None


@router.get("/{scan_id}", response_model=ScanRead)
def get_scan(
    scan_id: str,
    session: Session = Depends(get_session),
    may_advance: bool = Depends(operator_access_granted),
) -> ScanRead:
    scan = session.get(Scan, scan_id)
    if scan is None:
        raise HTTPException(status_code=404, detail="scan not found")
    response = scan_to_read(scan)
    if may_advance and scan.status == "running" and scan.mode in {"live", "replay", "live_with_fallback"}:
        company = session.get(Company, scan.company_id)
        if company is not None:
            ReviewRunner().advance(session, company, scan)
    return response
