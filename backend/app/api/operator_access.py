from hmac import compare_digest

from fastapi import Depends, Header, HTTPException

from app.config import Settings, get_settings


def require_operator_access(
    x_pulse_operator_token: str | None = Header(default=None, alias="X-Pulse-Operator-Token"),
    settings: Settings = Depends(get_settings),
) -> None:
    expected_token = settings.demo_api_token
    if not expected_token:
        return
    if not x_pulse_operator_token or not compare_digest(x_pulse_operator_token, expected_token):
        raise HTTPException(status_code=401, detail="Operator token required")
