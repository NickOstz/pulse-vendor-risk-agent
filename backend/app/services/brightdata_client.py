from dataclasses import dataclass
from time import perf_counter
from urllib.parse import urlencode

import httpx

from app.config import Settings, get_settings
from app.models import Company

BLOCK_PAGE_SIGNATURES = (
    "access denied",
    "attention required",
    "checking your browser",
    "cf-browser-verification",
    "captcha",
    "just a moment",
)


@dataclass(frozen=True)
class BrightDataAttempt:
    product: str
    operation: str
    source_url: str
    status: str
    latency_ms: int
    retry_count: int = 0
    error: str | None = None
    content: str | None = None


class BrightDataClient:
    """Bounded Bright Data caller for discovery and configured page capture."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    @property
    def serp_configured(self) -> bool:
        return bool(self.settings.brightdata_api_key and self.settings.brightdata_serp_zone)

    @property
    def unlocker_configured(self) -> bool:
        return bool(self.settings.brightdata_api_key and self.settings.brightdata_unlocker_zone)

    def search_vendor_risk(
        self,
        company: Company,
        *,
        signal_type: str = "trust_security",
        query: str | None = None,
    ) -> BrightDataAttempt:
        search_query = query or f"{company.name} {company.domain} trust security SOC 2 incident terms"
        target_url = "https://www.google.com/search?" + urlencode(
            {"q": search_query, "hl": "en", "gl": "us", "brd_json": "1", "brd_browser": "chrome"}
        )
        operation = f"discover:{signal_type}"
        started_at = perf_counter()

        try:
            response = httpx.post(
                self.settings.brightdata_request_endpoint,
                headers={
                    "Authorization": f"Bearer {self.settings.brightdata_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "zone": self.settings.brightdata_serp_zone,
                    "url": target_url,
                    "format": "raw",
                },
                timeout=self.settings.brightdata_serp_timeout_seconds,
            )
            response.raise_for_status()
            return BrightDataAttempt(
                product="serp_api",
                operation=operation,
                source_url=target_url,
                status="success",
                latency_ms=_elapsed_ms(started_at),
                content=response.text,
            )
        except httpx.TimeoutException:
            return BrightDataAttempt(
                product="serp_api",
                operation=operation,
                source_url=target_url,
                status="timeout",
                latency_ms=_elapsed_ms(started_at),
                error="Live SERP request exceeded the configured demo timeout.",
            )
        except httpx.HTTPStatusError as exc:
            return BrightDataAttempt(
                product="serp_api",
                operation=operation,
                source_url=target_url,
                status="failed",
                latency_ms=_elapsed_ms(started_at),
                error=f"Bright Data SERP returned HTTP {exc.response.status_code}.",
            )
        except httpx.RequestError as exc:
            return BrightDataAttempt(
                product="serp_api",
                operation=operation,
                source_url=target_url,
                status="failed",
                latency_ms=_elapsed_ms(started_at),
                error=f"Bright Data SERP request failed: {exc.__class__.__name__}.",
            )

    def fetch_source_text(
        self,
        source_url: str,
        *,
        signal_type: str = "trust_security",
        origin: str = "configured",
    ) -> BrightDataAttempt:
        operation = f"capture_text:{signal_type}:{origin}"
        started_at = perf_counter()
        payloads = [
            {
                "zone": self.settings.brightdata_unlocker_zone,
                "url": source_url,
                "format": "raw",
                "data_format": "markdown",
            },
            {
                "zone": self.settings.brightdata_unlocker_zone,
                "url": source_url,
                "format": "raw",
                "data_format": "markdown",
                "country": "us",
            },
            {
                "zone": self.settings.brightdata_unlocker_zone,
                "url": source_url,
                "format": "raw",
            },
        ]
        last_content_error = "Bright Data Web Unlocker returned an empty response body."
        attempt_index = 0

        try:
            for attempt_index, payload in enumerate(payloads):
                response = httpx.post(
                    self.settings.brightdata_unlocker_request_endpoint,
                    headers={
                        "Authorization": f"Bearer {self.settings.brightdata_api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                    timeout=self.settings.brightdata_live_fetch_timeout_seconds,
                )
                response.raise_for_status()
                body = response.text.strip()
                if not body:
                    last_content_error = "Bright Data Web Unlocker returned an empty response body."
                    continue
                provider_error = _bright_data_body_error(body)
                if provider_error is not None:
                    last_content_error = provider_error
                    continue
                block_page_error = _block_page_error(body)
                if block_page_error is not None:
                    last_content_error = block_page_error
                    continue
                return BrightDataAttempt(
                    product="web_unlocker",
                    operation=operation,
                    source_url=source_url,
                    status="success",
                    latency_ms=_elapsed_ms(started_at),
                    retry_count=attempt_index,
                    content=body,
                )
            return BrightDataAttempt(
                product="web_unlocker",
                operation=operation,
                source_url=source_url,
                status="failed",
                latency_ms=_elapsed_ms(started_at),
                retry_count=len(payloads) - 1,
                error=last_content_error,
            )
        except httpx.TimeoutException:
            return BrightDataAttempt(
                product="web_unlocker",
                operation=operation,
                source_url=source_url,
                status="timeout",
                latency_ms=_elapsed_ms(started_at),
                retry_count=attempt_index,
                error="Live page collection exceeded the configured demo timeout.",
            )
        except httpx.HTTPStatusError as exc:
            return BrightDataAttempt(
                product="web_unlocker",
                operation=operation,
                source_url=source_url,
                status="failed",
                latency_ms=_elapsed_ms(started_at),
                retry_count=attempt_index,
                error=f"Bright Data Web Unlocker returned HTTP {exc.response.status_code}.",
            )
        except httpx.RequestError as exc:
            return BrightDataAttempt(
                product="web_unlocker",
                operation=operation,
                source_url=source_url,
                status="failed",
                latency_ms=_elapsed_ms(started_at),
                retry_count=attempt_index,
                error=f"Bright Data Web Unlocker request failed: {exc.__class__.__name__}.",
            )

def _elapsed_ms(started_at: float) -> int:
    return max(0, round((perf_counter() - started_at) * 1000))


def _bright_data_body_error(body: str) -> str | None:
    first_line = body.splitlines()[0].strip()
    if first_line.startswith("Request Failed"):
        return first_line[:500]
    return None


def _block_page_error(body: str) -> str | None:
    normalized = body.casefold()
    normalized_prefix = body[:3000].casefold()
    for signature in BLOCK_PAGE_SIGNATURES:
        if signature in normalized_prefix:
            return f"Bright Data Web Unlocker returned a block page signature: {signature}."
    if len(body.encode("utf-8")) < 2000 and "cloudflare" in normalized:
        return "Bright Data Web Unlocker returned a likely block page instead of source content."
    return None
