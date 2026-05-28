from hmac import compare_digest

from fastapi import APIRouter, Depends, Header, HTTPException

from app.config import Settings, get_settings
from app.schemas import OperatorAccessRead

router = APIRouter(prefix="/api/operator-access", tags=["operator-access"])


def operator_access_granted(
    x_pulse_operator_token: str | None = Header(default=None, alias="X-Pulse-Operator-Token"),
    settings: Settings = Depends(get_settings),
) -> bool:
    expected_token = settings.demo_api_token
    if not expected_token:
        return True
    return bool(x_pulse_operator_token) and compare_digest(x_pulse_operator_token, expected_token)


def require_operator_access(
    granted: bool = Depends(operator_access_granted),
) -> None:
    if not granted:
        raise HTTPException(status_code=401, detail="Operator token required")


@router.get("", response_model=OperatorAccessRead)
def verify_operator_access(
    settings: Settings = Depends(get_settings),
    _operator_access: None = Depends(require_operator_access),
) -> OperatorAccessRead:
    return OperatorAccessRead(write_protection_enabled=bool(settings.demo_api_token))
