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
| `POST /api/companies` | Optional add form | Validate exact domain, owner, criticality, renewal date |
| `PATCH /api/companies/{id}/agent` | Agent toggle | Enable/disable; demo vendor becomes due now |
| `GET /api/agents/status` | Status panel | Return active scans and due vendors |
| `POST /api/agents/tick` | Demo recovery | Run the same due-vendor scheduling check |
| `POST /api/scans/run` | Hidden recovery | Start explicit fallback-only cycle |
| `GET /api/scans/{id}` | Polling strip | Return stages, status, mode, and budgets |
| `GET /api/alerts` | Alert list | Filter by `company_id` or `scan_id`; verified priority alerts only |
| `PATCH /api/alerts/{id}` | Review action | Accept `approved`, `dismissed`, or `needs_review` |
| `GET /api/companies/{id}/evidence` | Evidence drawer | Return evidence and source excerpt for a scan |
| `GET /api/brightdata/traces?scan_id=...` | Source Explorer | Return trace rows including source mode |
| `POST /api/briefs/vendor-review` | Brief view | Return `markdown` or `html` output from verified evidence |

## Core Response Shapes

### Company

```json
{
  "id": "vendor_uuid",
  "name": "DataForge",
  "domain": "example.com",
  "relationship_type": "database",
  "owner": "Security",
  "criticality": "critical",
  "renewal_date": "2026-07-10",
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
  "operation": "scrape_markdown",
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

- Toggling the demo vendor on sets a due-now policy and starts a review by the
  scheduler or the same tick mechanism.
- The frontend polls a running scan every two seconds and stops at terminal
  status.
- A live attempt that fails or exceeds eight seconds creates an honest failed
  trace followed by a fallback/cached trace.
- Alert presentation never implies unsupported evidence is verified.
