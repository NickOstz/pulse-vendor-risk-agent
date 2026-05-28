from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.config import Settings, get_settings
from app.db import get_session
from app.models import Company
from app.schemas import HealthRead
from app.services.replay_loader import replay_data_available

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthRead)
def health(session: Session = Depends(get_session), settings: Settings = Depends(get_settings)) -> HealthRead:
    database = session.exec(select(Company.id).limit(1)).first() is not None
    return HealthRead(
        status="ok" if database and replay_data_available() else "degraded",
        database=database,
        scheduler=True,
        replay_data=replay_data_available(),
        brightdata_key_present=bool(settings.brightdata_api_key),
        llm_key_present=bool(settings.aimlapi_api_key or settings.deepseek_api_key or settings.kiro_api_key),
        write_protection_enabled=bool(settings.demo_api_token),
    )
