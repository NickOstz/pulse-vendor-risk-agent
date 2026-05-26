from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import Company, utc_now
from app.schemas import AgentToggle, CompanyCreate, CompanyRead, SourceRulesUpdate
from app.services.serializers import company_to_read, dump_json, policy_for_company

router = APIRouter(prefix="/api/companies", tags=["companies"])


@router.get("", response_model=list[CompanyRead])
def list_companies(session: Session = Depends(get_session)) -> list[CompanyRead]:
    companies = session.exec(select(Company).order_by(Company.renewal_date, Company.name)).all()
    return [company_to_read(company) for company in companies]


@router.post("", response_model=CompanyRead, status_code=201)
def create_company(payload: CompanyCreate, session: Session = Depends(get_session)) -> CompanyRead:
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
def toggle_agent(company_id: str, payload: AgentToggle, session: Session = Depends(get_session)) -> CompanyRead:
    company = session.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="company not found")
    company.agent_enabled = payload.agent_enabled
    company.updated_at = utc_now()
    if payload.agent_enabled:
        review_policy, next_run_at = policy_for_company(company)
        company.agent_status = "active"
        company.review_policy = review_policy
        company.next_agent_run_at = next_run_at
    else:
        company.agent_status = "inactive"
        company.review_policy = None
        company.next_agent_run_at = None
    session.add(company)
    session.commit()
    session.refresh(company)
    return company_to_read(company)
