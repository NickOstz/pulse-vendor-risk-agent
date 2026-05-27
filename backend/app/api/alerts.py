from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db import get_session
from app.models import Alert
from app.schemas import AlertRead, AlertUpdate
from app.api.operator_access import require_operator_access
from app.services.serializers import alert_to_read

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertRead])
def list_alerts(
    company_id: str | None = Query(default=None),
    scan_id: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> list[AlertRead]:
    statement = select(Alert)
    if company_id:
        statement = statement.where(Alert.company_id == company_id)
    if scan_id:
        statement = statement.where(Alert.scan_id == scan_id)
    alerts = session.exec(statement.order_by(Alert.score.desc(), Alert.created_at.desc())).all()
    return [alert_to_read(alert) for alert in alerts]


@router.patch("/{alert_id}", response_model=AlertRead)
def update_alert(
    alert_id: str,
    payload: AlertUpdate,
    session: Session = Depends(get_session),
    _operator_access: None = Depends(require_operator_access),
) -> AlertRead:
    alert = session.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="alert not found")
    alert.status = payload.status
    session.add(alert)
    session.commit()
    session.refresh(alert)
    return alert_to_read(alert)
