# MVP API Contract

This contract lets frontend and backend work in parallel. Change it only in a
coordinated pull request.

## Ownership Boundary

The frontend calls only `/api/*` on the FastAPI service. The backend performs
all Bright Data and LLM operations and returns safe UI data.

## Status Constants

```text
agent_status: inactive | active | running | completed | needs_review
scan_status: queued | running | completed | failed | completed_with_fallback
scan_mode: live | replay | live_with_fallback
stage: collect | extract | verify | score | brief
support_status: verified | needs_review | no_evidence | failed_source
source_mode: live | cached | fallback
criticality: critical | important | normal
signal_type: trust_security | adverse_media | pricing_terms
```

## Endpoints

| Method and path | Consumer | Required MVP behavior |
| --- | --- | --- |
| `GET /api/health` | Demo readiness | Return DB, scheduler, replay, and credential presence booleans |
| `GET /api/companies` | Command Center | Return watchlist and agent fields |
| `POST /api/companies` | Optional add form | Validate exact domain, owner, criticality, renewal date, and optional source rules |
| `PATCH /api/companies/{id}/source-rules` | Source rules panel | Store vendor allow/block source rules for future reviews |
| `PATCH /api/companies/{id}/agent` | Agent toggle | Enable/disable; demo vendor becomes due now |
| `PATCH /api/agents/watchlist` | Watchlist command | Enable/disable every vendor and assign each vendor's review policy |
| `GET /api/agents/status` | Status panel | Return active scans and due vendors |
| `POST /api/agents/tick` | Demo recovery | Run the same due-vendor scheduling check |
| `POST /api/scans/run` | Hidden recovery | Start explicit fallback-only cycle |
| `GET /api/scans/latest?company_id={id}` | Completed result view | Return the most recent scan even when it created no alert |
| `GET /api/scans/{id}` | Polling strip | Return stages, status, mode, and budgets; polling progression requires operator access when protected |
| `GET /api/alerts` | Alert list | Filter by `company_id` or `scan_id`; verified priority alerts only |
| `PATCH /api/alerts/{id}` | Review action | Accept `approved`, `dismissed`, or `needs_review` |
| `GET /api/companies/{id}/evidence` | Evidence drawer | Return evidence and source excerpt for a scan |
| `GET /api/brightdata/traces?scan_id=...` | Source Explorer | Return trace rows including source mode |
| `POST /api/briefs/vendor-review` | Brief view | Return `markdown` or `html` output from verified evidence |

## Operator Write Protection

When the backend is configured with `DEMO_API_TOKEN`, mutating and
manual-trigger endpoints require `X-Pulse-Operator-Token: <token>`. This
protects hosted Bright Data and DeepSeek usage from public clicks while all
read-only evidence, trace, and completed brief views remain shareable.

Protected endpoints are:

- `POST /api/companies`
- `PATCH /api/companies/{id}/source-rules`
- `PATCH /api/companies/{id}/agent`
- `PATCH /api/agents/watchlist`
- `POST /api/agents/tick`
- `POST /api/scans/run`
- `PATCH /api/alerts/{id}`

`GET /api/health` returns `write_protection_enabled` so the frontend can show
the operator-lock control. The frontend may keep an operator token in
per-tab session storage for demo operation; it must never put this token in a
public build-time variable.

`GET /api/scans/{id}` stays readable without a token, including for a running
scan. In unprotected local mode its polling request advances the demo cycle as
before. When `DEMO_API_TOKEN` is configured, an unauthenticated poll is
read-only; only an operator-token poll may invoke poll-driven progression.
The opt-in backend scheduler may independently advance intentionally enabled
monitoring cycles. The single-replica runtime serializes scan-stage advancement
so concurrent operator tabs or scheduler/poll overlap cannot execute a
provider-backed stage more than once or bypass per-review budgets.

## Core Response Shapes

### Company

```json
{
  "id": "vendor-cloudflare-demo",
  "name": "Cloudflare",
  "domain": "cloudflare.com",
  "relationship_type": "edge security",
  "owner": "Security",
  "criticality": "critical",
  "renewal_date": "2026-07-10",
  "allow_list": ["https://www.cloudflare.com/trust-hub/"],
  "block_list": [],
  "agent_enabled": false,
  "agent_status": "inactive",
  "review_policy": null,
  "last_agent_run_at": null,
  "next_agent_run_at": null
}
```

### Scan Status

```json
{
  "id": "scan_uuid",
  "company_id": "vendor_uuid",
  "status": "running",
  "mode": "live_with_fallback",
  "current_stage": "verify",
  "stages": [
    {"name": "collect", "status": "completed"},
    {"name": "extract", "status": "completed"},
    {"name": "verify", "status": "running"},
    {"name": "score", "status": "pending"},
    {"name": "brief", "status": "pending"}
  ],
  "metrics": {
    "serp_queries_used": 2,
    "urls_scraped": 4,
    "llm_calls_used": 4,
    "evidence_count": 2,
    "verified_count": 1
  }
}
```

### Evidence Item

```json
{
  "id": "evidence_uuid",
  "scan_id": "scan_uuid",
  "company_id": "vendor_uuid",
  "signal_type": "trust_security",
  "claim": "A public trust-page statement changed.",
  "supporting_quote": "Captured supporting text.",
  "source_url": "https://example.com/trust",
  "source_type": "vendor_owned",
  "published_or_captured_at": "2026-05-26T10:00:00Z",
  "severity_hint": "medium",
  "confidence": 0.9,
  "recommended_action": "Review with the vendor owner.",
  "support_status": "verified",
  "quote_match_score": 0.96,
  "source_excerpt": "Captured supporting text in context."
}
```

### Bright Data Trace

```json
{
  "id": "trace_uuid",
  "scan_id": "scan_uuid",
  "product": "web_unlocker",
  "operation": "capture_text:trust_security:serp",
  "source_url": "https://example.com/trust",
  "status": "success",
  "latency_ms": 740,
  "retry_count": 0,
  "error": null,
  "source_mode": "live",
  "created_at": "2026-05-26T10:00:00Z"
}
```

## Demo-Critical Behavior

- Toggling one selected vendor on schedules its first review due now. The
  in-process scheduler advances due and running scans when enabled; the tick
  endpoint remains a demo recovery trigger.
- Completed monitored vendors receive their next review time from policy:
  daily for critical renewal reviews and weekly for weekly reviews.
- The frontend polls a running scan every two seconds and stops at terminal
  status; in a protected hosted demo the operator token is required for that
  polling to advance a cycle.
- A live attempt that fails or exceeds eight seconds creates an honest failed
  trace followed by a fallback/cached trace.
- Live investigation issues bounded trust/security, pricing/terms, and
  adverse-media SERP queries, then captures eligible discovered public pages.
- Vendor-owned discoveries must match the exact configured vendor domain or a
  subdomain. Public adverse-media discoveries may use third-party public
  sources, while block rules remain enforced.
- A configured vendor-owned URL may be included as a reliable known source
  only when allow/block rules permit it.
- The rehearsed Cloudflare vendor may use its labeled fallback payload. An
  added vendor may run a bounded SERP-led live/model review and never receives
  Cloudflare fallback evidence.
- DeepSeek extracts candidate findings from captured pages and may synthesize
  a brief from two or more verified live findings. Quote verification remains
  the scoring gate.
- A first verified live review establishes a baseline. A later identical
  source-backed finding remains auditable in its brief but does not create a
  duplicate alert; changed or newly discovered verified evidence may alert.
- Alert presentation never implies unsupported evidence is verified.
