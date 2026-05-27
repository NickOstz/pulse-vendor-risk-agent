from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import Session, select

from app.db import get_session
from app.models import Alert, Brief, BrightDataTrace, Company, EvidenceItem, Scan, utc_now
from app.schemas import AgentToggle, CompanyCreate, CompanyRead, SourceRulesUpdate
from app.api.operator_access import require_operator_access
from app.services.serializers import apply_agent_state, company_to_read, dump_json

router = APIRouter(prefix="/api/companies", tags=["companies"])


@router.get("", response_model=list[CompanyRead])
def list_companies(session: Session = Depends(get_session)) -> list[CompanyRead]:
    companies = session.exec(select(Company).order_by(Company.renewal_date, Company.name)).all()
    return [company_to_read(company) for company in companies]


@router.post("", response_model=CompanyRead, status_code=201)
def create_company(
    payload: CompanyCreate,
    session: Session = Depends(get_session),
    _operator_access: None = Depends(require_operator_access),
) -> CompanyRead:
    existing = session.exec(select(Company).where(Company.domain == payload.domain)).first()
    if existing:
        raise HTTPException(status_code=409, detail="company domain already exists")
    company = Company(
        name=payload.name.strip(),
        domain=payload.domain,
        relationship_type=payload.relationship_type.strip(),
        owner=payload.owner.strip(),
        criticality=payload.criticality,
        renewal_date=payload.renewal_date,
        allow_list_json=dump_json(payload.allow_list),
        block_list_json=dump_json(payload.block_list),
    )
    session.add(company)
    session.commit()
    session.refresh(company)
    return company_to_read(company)


@router.patch("/{company_id}/source-rules", response_model=CompanyRead)
def update_source_rules(
    company_id: str,
    payload: SourceRulesUpdate,
    session: Session = Depends(get_session),
    _operator_access: None = Depends(require_operator_access),
) -> CompanyRead:
    company = session.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="company not found")
    company.allow_list_json = dump_json(payload.allow_list)
    company.block_list_json = dump_json(payload.block_list)
    company.updated_at = utc_now()
    session.add(company)
    session.commit()
    session.refresh(company)
    return company_to_read(company)


@router.patch("/{company_id}/agent", response_model=CompanyRead)
def toggle_agent(
    company_id: str,
    payload: AgentToggle,
    session: Session = Depends(get_session),
    _operator_access: None = Depends(require_operator_access),
) -> CompanyRead:
    company = session.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="company not found")
    apply_agent_state(company, payload.agent_enabled)
    if payload.agent_enabled:
        company.next_agent_run_at = utc_now()
    session.add(company)
    session.commit()
    session.refresh(company)
    return company_to_read(company)


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_company(
    company_id: str,
    session: Session = Depends(get_session),
    _operator_access: None = Depends(require_operator_access),
) -> Response:
    company = session.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="company not found")

    for model in (Alert, Brief, BrightDataTrace, EvidenceItem, Scan):
        rows = session.exec(select(model).where(model.company_id == company.id)).all()
        for row in rows:
            session.delete(row)
    session.delete(company)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
