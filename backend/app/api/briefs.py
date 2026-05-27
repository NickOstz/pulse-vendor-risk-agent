from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import Brief, BrightDataTrace, Company, EvidenceItem, Scan, utc_now
from app.schemas import BriefRead, BriefRequest
from app.services.brief_renderer import render_vendor_review_brief

router = APIRouter(prefix="/api/briefs", tags=["briefs"])


@router.post("/vendor-review", response_model=BriefRead)
def vendor_review_brief(payload: BriefRequest, session: Session = Depends(get_session)) -> BriefRead:
    brief = session.exec(
        select(Brief).where(Brief.company_id == payload.company_id, Brief.scan_id == payload.scan_id)
    ).first()
    if brief is None:
        brief = _render_missing_completed_brief(session, payload)
    elif "| Signal | Severity |" not in brief.markdown:
        brief = _rerender_completed_brief(session, payload, brief)
    content = brief.markdown if payload.format == "markdown" else brief.html
    return BriefRead(company_id=payload.company_id, scan_id=payload.scan_id, format=payload.format, content=content)


def _render_missing_completed_brief(session: Session, payload: BriefRequest) -> Brief:
    company = session.get(Company, payload.company_id)
    scan = session.get(Scan, payload.scan_id)
    if company is None or scan is None or scan.company_id != company.id:
        raise HTTPException(status_code=404, detail="brief not found for company and scan")
    if scan.status not in {"completed", "completed_with_fallback"}:
        raise HTTPException(status_code=404, detail="brief not generated yet")

    evidence_items = session.exec(select(EvidenceItem).where(EvidenceItem.scan_id == scan.id)).all()
    verified_items = [item for item in evidence_items if item.support_status == "verified"]
    traces = session.exec(select(BrightDataTrace).where(BrightDataTrace.scan_id == scan.id)).all()
    markdown, html = render_vendor_review_brief(company, verified_items, traces)
    brief = Brief(
        company_id=company.id,
        scan_id=scan.id,
        markdown=markdown,
        html=html,
        created_at=utc_now(),
    )
    session.add(brief)
    session.commit()
    session.refresh(brief)
    return brief


def _rerender_completed_brief(session: Session, payload: BriefRequest, brief: Brief) -> Brief:
    company = session.get(Company, payload.company_id)
    scan = session.get(Scan, payload.scan_id)
    if company is None or scan is None or scan.company_id != company.id:
        raise HTTPException(status_code=404, detail="brief not found for company and scan")
    if scan.status not in {"completed", "completed_with_fallback"}:
        return brief

    evidence_items = session.exec(select(EvidenceItem).where(EvidenceItem.scan_id == scan.id)).all()
    verified_items = [item for item in evidence_items if item.support_status == "verified"]
    traces = session.exec(select(BrightDataTrace).where(BrightDataTrace.scan_id == scan.id)).all()
    brief.markdown, brief.html = render_vendor_review_brief(company, verified_items, traces)
    session.add(brief)
    session.commit()
    session.refresh(brief)
    return brief
