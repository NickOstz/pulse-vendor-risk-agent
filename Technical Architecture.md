# Technical Architecture

## 1. System Overview

Pulse is an autonomous vendor risk agent for third-party risk review. The MVP uses a Next.js frontend, a FastAPI backend, SQLite persistence, a lightweight scheduler, Bright Data collection, deterministic quote verification, deterministic scoring, and LLM-assisted evidence extraction.

The system is optimized for speed, reliability, and demo readiness:

- One frontend app presents the Command Center, Evidence Drawer / Source Explorer, and Vendor Risk Assessment Brief.
- One backend service owns agent scheduling, review-cycle execution, evidence extraction, verification, scoring, traces, and brief generation.
- SQLite keeps setup fast and avoids managed database overhead.
- A lightweight in-process scheduler or `agents/tick` endpoint demonstrates autonomous behavior.
- Replay mode guarantees a full demo path if external services fail.
- One live Bright Data fetch or honest live attempt proves real public-web collection.
- Every source collection operation writes trace telemetry visible in the UI.

The MVP does not include SSO, RBAC, tenant isolation, external workflow integrations, broad market intelligence, scheduled production infrastructure, or a multi-agent framework.

## 2. Frontend Architecture

### Stack

- Next.js
- React
- TypeScript
- Tailwind CSS

### Product Surfaces

The frontend has three surfaces only:

1. **Command Center**
   - vendor cards
   - renewal urgency
   - criticality
   - owner
   - risk delta
   - latest alerts
   - Vendor Risk Agent status

2. **Evidence Drawer / Source Explorer**
   - alert detail
   - source URL
   - captured timestamp
   - supporting quote
   - support status
   - confidence
   - source mode
   - Bright Data trace rows
   - scoring explanation

3. **Vendor Risk Assessment Brief**
   - summary
   - key verified changes
   - evidence table
   - risk interpretation
   - recommended action
   - suggested owner
   - review status

### Suggested Structure

```text
frontend/
  app/
    page.tsx
    components/
      CommandCenter.tsx
      VendorCard.tsx
      AgentToggle.tsx
      AgentStatusPanel.tsx
      ReviewStatusStrip.tsx
      EvidenceDrawer.tsx
      SourceExplorer.tsx
      QuoteVerificationView.tsx
      RiskAssessmentBrief.tsx
      ScoreTooltip.tsx
    lib/
      api.ts
      types.ts
      formatters.ts
```

### State Management

Use local React state and simple API helpers. Do not add Redux, Zustand, or a complex client cache for the MVP.

Required state:

- selected vendor
- selected alert
- agent status
- active scan/review-cycle ID
- review-cycle stage status
- evidence items
- trace rows
- generated brief
- drawer open/closed state

### Agent Interaction

The primary control is **Vendor Risk Agent**, not a scan button.

Demo sequence:

1. User selects the demo vendor.
2. User toggles **Vendor Risk Agent** from Off to On.
3. Agent status panel shows:
   - monitoring mode: `autonomous`
   - review policy: `critical vendor, renewal within 60 days`
   - next review: `due now`
   - current activity: `waiting` then `investigating public sources`
4. The frontend observes an active review cycle and begins polling.

A secondary **Run Review Now** button may exist for recovery but should not be the primary demo path.

### Polling

Poll `GET /api/scans/{scan_id}` every 2 seconds while a review cycle is active.

Stop polling when status is:

- `completed`
- `failed`
- `completed_with_fallback`

## 3. Backend Architecture

### Stack

- Python
- FastAPI
- SQLModel or SQLAlchemy
- Pydantic
- SQLite
- RapidFuzz
- Bright Data API / MCP wrapper
- LLM provider wrapper

### Suggested Structure

```text
backend/
  app/
    main.py
    config.py
    db.py
    models.py
    schemas.py
    api/
      companies.py
      agents.py
      scans.py
      alerts.py
      evidence.py
      traces.py
      briefs.py
      health.py
    services/
      agent_scheduler.py
      review_runner.py
      review_budget.py
      brightdata_client.py
      replay_loader.py
      extraction.py
      verification.py
      scoring.py
      related_changes.py
      brief_renderer.py
    seeds/
      companies.json
      replay_securepay_review.json
    snapshots/
      cached_sources/
```

### Execution Model

Use a simple in-process scheduler and FastAPI background tasks. Avoid Celery, Redis queues, Temporal, or distributed workers for the MVP.

The backend has two main loops:

1. API request/response loop for UI actions and polling.
2. Lightweight agent scheduler loop or `POST /api/agents/tick` path for due-vendor checks.

### Agent Scheduler

The scheduler:

- finds vendors where `agent_enabled = true`,
- checks `next_agent_run_at <= now`,
- skips vendors with an already-running review cycle,
- creates a `scans` row,
- updates `agent_status = running`,
- starts the review runner,
- updates `last_agent_run_at` and `next_agent_run_at` after completion.

For demo reliability, `POST /api/agents/tick` can trigger the same due-vendor check immediately.

### Review Runner

The review runner executes:

1. collect sources
2. extract evidence
3. verify quotes
4. score verified evidence
5. create alerts and related-change card
6. render Vendor Risk Assessment Brief
7. complete review cycle

## 4. Database Schema

SQLite is the MVP database. Use UUID strings for IDs and ISO 8601 strings for timestamps.

### `companies`

| Column | Type | Notes |
|---|---|---|
| `id` | text primary key | UUID |
| `name` | text | Vendor display name |
| `domain` | text | Required exact domain |
| `relationship_type` | text | Example: database, payments, analytics |
| `owner` | text | Required business owner |
| `criticality` | text | `critical`, `important`, `normal` |
| `renewal_date` | text | ISO date |
| `allow_list_json` | text | JSON array |
| `block_list_json` | text | JSON array |
| `agent_enabled` | boolean | Whether agent is active |
| `agent_status` | text | `inactive`, `active`, `running`, `completed`, `needs_review` |
| `review_policy` | text | Example: `critical_renewal_due`, `weekly` |
| `last_agent_run_at` | text nullable | ISO timestamp |
| `next_agent_run_at` | text nullable | ISO timestamp |
| `created_at` | text | ISO timestamp |
| `updated_at` | text | ISO timestamp |

### `scans`

This table represents autonomous review cycles.

| Column | Type | Notes |
|---|---|---|
| `id` | text primary key | UUID |
| `company_id` | text | FK to `companies.id` |
| `status` | text | `queued`, `running`, `completed`, `failed`, `completed_with_fallback` |
| `mode` | text | `live`, `replay`, `live_with_fallback` |
| `current_stage` | text | `collect`, `extract`, `verify`, `score`, `brief` |
| `started_at` | text | ISO timestamp |
| `completed_at` | text nullable | ISO timestamp |
| `serp_queries_used` | integer | Max 6 |
| `urls_scraped` | integer | Max 12 |
| `llm_calls_used` | integer | Max 20 |
| `source_count` | integer | Captured source count |
| `evidence_count` | integer | Extracted evidence count |
| `verified_count` | integer | Verified evidence count |
| `content_hashes_json` | text | JSON array |
| `error` | text nullable | Failure message |

### `evidence_items`

| Column | Type | Notes |
|---|---|---|
| `id` | text primary key | UUID |
| `scan_id` | text | FK to `scans.id` |
| `company_id` | text | FK to `companies.id` |
| `signal_type` | text | `trust_security`, `adverse_media`, `pricing_terms` |
| `claim` | text | Extracted claim |
| `supporting_quote` | text | Extracted quote |
| `source_url` | text | Public source URL |
| `source_type` | text | Vendor-owned, news, regulator, general web |
| `published_or_captured_at` | text | ISO timestamp/date |
| `severity_hint` | text | `low`, `medium`, `high` |
| `confidence` | real | LLM confidence |
| `recommended_action` | text | Suggested action |
| `support_status` | text | `verified`, `needs_review`, `no_evidence`, `failed_source` |
| `quote_match_score` | real nullable | RapidFuzz score |
| `snapshot_path` | text nullable | Local cached markdown path |
| `source_excerpt` | text nullable | Excerpt for highlighted view |
| `created_at` | text | ISO timestamp |

### `alerts`

| Column | Type | Notes |
|---|---|---|
| `id` | text primary key | UUID |
| `company_id` | text | FK to `companies.id` |
| `scan_id` | text | FK to `scans.id` |
| `evidence_item_id` | text nullable | FK to `evidence_items.id` |
| `alert_type` | text | `signal` or `related_change` |
| `title` | text | Alert title |
| `summary` | text | Concise explanation |
| `score` | integer | 0 to 100 |
| `severity` | text | `low`, `medium`, `high` |
| `status` | text | `new`, `approved`, `dismissed`, `needs_review` |
| `owner` | text | Suggested owner |
| `recommended_action` | text | Action text |
| `related_evidence_ids_json` | text | JSON array |
| `score_factors_json` | text | Values used in deterministic scoring |
| `created_at` | text | ISO timestamp |

### `brightdata_traces`

| Column | Type | Notes |
|---|---|---|
| `id` | text primary key | UUID |
| `scan_id` | text | FK to `scans.id` |
| `company_id` | text | FK to `companies.id` |
| `product` | text | SERP, markdown scrape, Web Unlocker |
| `operation` | text | Query or scrape operation |
| `source_url` | text nullable | URL when available |
| `status` | text | `success`, `failed`, `timeout`, `fallback_used`, `cached` |
| `latency_ms` | integer nullable | Measured duration |
| `retry_count` | integer | Retry count |
| `error` | text nullable | Error details |
| `source_mode` | text | `live`, `cached`, `fallback` |
| `created_at` | text | ISO timestamp |

### Local Snapshot Files

Raw markdown snapshots are stored under:

```text
backend/app/snapshots/
```

Database rows store snapshot paths instead of large markdown blobs.

## 5. AI/Agent Architecture

Pulse uses a bounded autonomous agent workflow, not an open-ended agent swarm.

The agent has autonomy inside fixed limits:

- fixed source categories
- fixed review budgets
- fixed Bright Data tools
- fixed output schema
- deterministic verification
- deterministic scoring

### Agent Trigger

The agent starts when a vendor is due for review.

Trigger inputs:

- `agent_enabled`
- `last_agent_run_at`
- `next_agent_run_at`
- renewal date
- criticality
- source rules

MVP review policy:

| Vendor Context | Behavior |
|---|---|
| Critical vendor with renewal within 60 days | Due now or daily |
| Critical vendor outside 60 days | Weekly |
| Important vendor | Weekly |
| Normal vendor | Manual or low frequency |
| Demo vendor | Due immediately after enablement |

### Stage 1: Collect

The collect stage is deterministic.

Inputs:

- vendor domain
- source rules
- renewal date
- criticality
- review budget

Actions:

- build targeted SERP queries from fixed templates
- call Bright Data SERP
- scrape known public pages as markdown
- use Web Unlocker fallback only for a tested blocked public source
- write trace rows for every operation
- store source snapshots and hashes

### Stage 2: Extract and Verify

The extraction stage uses the LLM only for structured extraction.

Supported templates:

- trust/security
- adverse media
- pricing/terms

Programmatic safeguards:

- validate extraction JSON with Pydantic
- retry malformed JSON once
- store raw source and create no alert on second failure
- normalize source and quote text
- verify quote support with exact match or RapidFuzz score above 0.8
- mark weak evidence as `needs_review`

### Stage 3: Score and Assess

Risk score is deterministic:

```text
SignalScore = BaseSeverity * SourceReliability * Confidence * Freshness * VendorCriticality
DisplayScore = min(100, round(SignalScore * 100))
```

The LLM may write concise assessment wording after evidence is validated. It does not assign the score.

The brief is template-first:

- summary
- key verified changes
- evidence table
- risk interpretation
- recommended action
- suggested owner
- review status

## 6. Data Pipeline

### Agent Enablement Pipeline

1. User toggles **Vendor Risk Agent** on.
2. Frontend calls `PATCH /api/companies/{company_id}/agent`.
3. Backend sets `agent_enabled = true`.
4. Backend assigns review policy.
5. For demo vendor, backend sets `next_agent_run_at <= now`.
6. Agent status panel updates to `active`.

### Autonomous Review Pipeline

1. Scheduler or `POST /api/agents/tick` checks due vendors.
2. Due vendor starts a review cycle.
3. Backend creates `scans` row.
4. Backend sets `agent_status = running`.
5. Review runner collects public sources through Bright Data.
6. Bright Data wrapper writes trace rows.
7. Markdown snapshots and content hashes are stored.
8. Extraction service sends relevant source text to LLM.
9. Pydantic validates extracted evidence.
10. Verification service quote-matches evidence against captured source text.
11. Scoring service scores verified evidence.
12. Alert service creates signal alerts and related-change card.
13. Brief service creates assessment brief.
14. Backend marks review cycle complete and updates agent status.

### Replay Pipeline

1. Scheduler starts a replay review cycle for the demo vendor.
2. Replay loader inserts seeded traces, evidence, alerts, source excerpts, related-change card, and brief content.
3. Review stages advance through the same status API.
4. Trace rows use `source_mode = cached`.
5. Frontend renders the same flow as live/fallback mode.

### Fallback Pipeline

1. Live Bright Data fetch starts.
2. If fetch fails or exceeds 8 seconds, backend records failed or timed-out trace.
3. Backend loads cached payload.
4. Backend records fallback or cached trace.
5. Review continues with cached source text.
6. UI labels source mode as `fallback` or `cached`.
7. Review completes as `completed_with_fallback`.

## 7. API Design

Base path: `/api`

### Health

#### `GET /api/health`

Returns backend readiness.

```json
{
  "status": "ok",
  "database": true,
  "scheduler": true,
  "replay_data": true,
  "brightdata_key_present": true,
  "llm_key_present": true
}
```

### Companies

#### `GET /api/companies`

Returns vendor watchlist with agent fields.

#### `POST /api/companies`

Creates a vendor.

Required fields:

- `name`
- `domain`
- `owner`
- `criticality`
- `renewal_date`

### Agent

#### `PATCH /api/companies/{company_id}/agent`

Enables or disables the Vendor Risk Agent.

Request:

```json
{
  "agent_enabled": true
}
```

Response includes updated agent status and review policy.

#### `GET /api/agents/status`

Returns active agent runs and due vendors.

```json
{
  "active_runs": [
    {
      "company_id": "company_uuid",
      "scan_id": "scan_uuid",
      "current_stage": "collect"
    }
  ],
  "due_vendors": []
}
```

#### `POST /api/agents/tick`

Runs a due-vendor check and starts eligible autonomous review cycles.

### Scans / Review Cycles

#### `POST /api/scans/run`

Fallback-only endpoint for demo recovery. It starts a review cycle manually when needed.

#### `GET /api/scans/{scan_id}`

Returns review-cycle status and stage metrics.

```json
{
  "id": "scan_uuid",
  "company_id": "company_uuid",
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
    "llm_calls_used": 6,
    "evidence_count": 3,
    "verified_count": 2
  }
}
```

### Alerts

#### `GET /api/alerts`

Query params:

- `company_id`
- `scan_id`

Returns prioritized alert cards.

#### `PATCH /api/alerts/{alert_id}`

Updates alert status.

Allowed statuses:

- `approved`
- `dismissed`
- `needs_review`

### Evidence

#### `GET /api/companies/{company_id}/evidence`

Query params:

- `scan_id`

Returns evidence items, source metadata, source excerpts, quote match scores, and support states.

### Bright Data Traces

#### `GET /api/brightdata/traces?scan_id=...`

Returns trace rows for Source Explorer.

### Briefs

#### `POST /api/briefs/vendor-review`

Generates or returns the Vendor Risk Assessment Brief.

Request:

```json
{
  "company_id": "company_uuid",
  "scan_id": "scan_uuid",
  "format": "markdown"
}
```

Allowed formats:

- `markdown`
- `html`

## 8. Authentication Plan

No full user authentication is required for the MVP product flow.

For local demo:

- frontend and backend run locally
- no login screen
- Bright Data and LLM credentials stay server-side in environment variables

For hosted demo:

- use a private demo URL when possible
- optionally protect backend write endpoints with one shared demo API token
- do not implement user accounts, SSO, RBAC, roles, teams, or tenant isolation

The frontend must never expose Bright Data or LLM credentials.

## 9. Deployment Plan

### Local Demo Default

Local demo is the preferred path.

- Frontend: Next.js dev server
- Backend: FastAPI with Uvicorn
- Database: local SQLite file
- Replay data: committed JSON files
- Snapshots: local markdown files

### Hosted Demo Option

Use only if time allows:

- Frontend on Vercel
- Backend on Railway
- SQLite file initialized from seed data
- Environment variables configured on backend host
- Replay data deployed with backend

### Environment Variables

Backend:

```text
DATABASE_URL=sqlite:///./pulse.db
BRIGHTDATA_API_KEY=...
BRIGHTDATA_SERP_ENDPOINT=...
BRIGHTDATA_WEB_UNLOCKER_ENDPOINT=...
DEEPSEEK_API_KEY=...
OPENAI_API_KEY=...
DEFAULT_REVIEW_MODE=live_with_fallback
DEMO_API_TOKEN=...
```

Frontend:

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## 10. Logging and Monitoring

Keep logging simple and demo-visible.

### Application Logs

Backend logs to console:

- agent enabled
- due-vendor check started
- review cycle started
- review stage changed
- Bright Data call started/completed/failed
- fallback used
- extraction validation failed
- quote verification result
- alert created
- brief generated

### Product Telemetry

Use `brightdata_traces` as the main demo telemetry table.

Trace rows must show:

- product
- operation
- URL
- status
- latency
- retry count
- error
- source mode
- timestamp

### Health Monitoring

`GET /api/health` checks:

- database connection
- scheduler availability
- replay seed availability
- Bright Data key presence
- LLM key presence

No external observability platform is required for the MVP.

## 11. Failure Handling

### Scheduler Does Not Start

- Use `POST /api/agents/tick` to force due-vendor check.
- If still blocked, use fallback-only `POST /api/scans/run`.
- UI should label this as demo recovery if shown.

### Bright Data Timeout or Failure

- Apply 8-second timeout for demo-critical live fetch.
- Record failed or timed-out trace row.
- Load cached payload when available.
- Continue review with `source_mode = fallback` or `cached`.
- Mark review cycle `completed_with_fallback`.

### LLM Malformed JSON

- Retry once with a simpler extraction prompt.
- If retry fails, store raw source snapshot.
- Create no alert from that source.
- Mark related source evidence as `failed_source` when needed.

### Quote Verification Failure

- Mark evidence `needs_review`.
- Do not create high-priority alert.
- Keep evidence visible if useful for transparency.

### Review Budget Exhausted

- Stop additional collection or extraction calls.
- Save current metrics.
- Continue scoring with available verified evidence.
- Show budget usage in review status.

### Backend Error During Review

- Mark review cycle `failed`.
- Store error message on scan row.
- Return failure status through polling.
- Preserve existing trace rows.

### Frontend Polling Error

- Show compact error state in review status strip.
- Allow user to retry or switch to replay data.
- Keep existing alerts and evidence viewable.

## 12. Mock vs Real Components

### Must Be Real

- Vendor Risk Agent toggle and visible agent status.
- Due-now autonomous review behavior for the demo vendor.
- Scheduler or `agents/tick` mechanism that starts a due review cycle.
- SQLite tables for companies, scans, evidence, alerts, and Bright Data traces.
- At least one live Bright Data fetch attempt or honest live attempt with fallback.
- Trace logging with `live`, `cached`, and `fallback` source modes.
- Captured source URL, timestamp, and source metadata for demo evidence.
- Quote verification using exact match or RapidFuzz.
- Deterministic scoring and capped 0 to 100 display score.
- High-priority alerts requiring verified evidence.
- Command Center to Evidence Drawer to Vendor Risk Assessment Brief flow.

### Can Be Mocked or Seeded

- Non-demo vendors.
- Replay review-cycle results.
- Cached source snapshots.
- Related-change card for the curated demo vendor, if linked evidence exists.
- LLM brief wording in replay mode.
- Watchlist-level agent enablement.
- Vendor creation UI if seeded vendors are enough.
- Alert approval and dismissal if time is tight.
- Hosted deployment if local demo is reliable.
- HTML styling polish.

## 13. Architecture Diagram in Text

```text
User
  |
  v
Next.js Frontend
  |
  |-- GET /api/companies
  |-- PATCH /api/companies/{company_id}/agent
  |-- GET /api/agents/status
  |-- POST /api/agents/tick
  |-- GET /api/scans/{scan_id} every 2 seconds
  |-- GET /api/alerts
  |-- GET /api/companies/{company_id}/evidence
  |-- GET /api/brightdata/traces?scan_id=...
  |-- POST /api/briefs/vendor-review
  |
  v
FastAPI Backend
  |
  |-- Agent Scheduler
  |     |
  |     |-- Check due vendors
  |     |-- Start review cycle
  |
  |-- Review Runner
  |     |
  |     |-- Collect Sources
  |     |     |
  |     |     |-- Bright Data SERP
  |     |     |-- Bright Data Markdown Scrape
  |     |     |-- Web Unlocker Fallback
  |     |     |-- Replay Loader
  |     |
  |     |-- Extract Evidence with LLM
  |     |-- Validate JSON with Pydantic
  |     |-- Verify Quotes with RapidFuzz
  |     |-- Score Verified Evidence
  |     |-- Create Alerts and Related-Change Card
  |     |-- Render Vendor Risk Assessment Brief
  |
  v
SQLite Database
  |
  |-- companies
  |-- scans
  |-- evidence_items
  |-- alerts
  |-- brightdata_traces
  |
  v
Local Snapshot and Replay Files
  |
  |-- cached markdown sources
  |-- replay payloads
```

## 14. Implementation Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Autonomous behavior feels scripted | Judges may not credit the agentic workflow | Use real agent fields, due-now policy, scheduler/tick path, visible status changes, and no primary scan button |
| Scheduler fails during demo | Review cycle may not start | Keep `POST /api/agents/tick` and fallback-only review endpoint available |
| Live Bright Data fetch fails | Demo may appear broken | Use one tested live URL, 8-second timeout, cached fallback, and honest source-mode labels |
| LLM extraction returns invalid JSON | Evidence pipeline may stall | Use strict schema, Pydantic validation, one retry, and replay data |
| Quote verification misses valid evidence | Good evidence may be downgraded | Normalize text and tune RapidFuzz threshold on seeded examples |
| Unsupported AI claim becomes high-priority alert | Product trust is damaged | Only verified evidence can create high-priority alerts |
| Frontend waits too long for review stages | Demo pacing suffers | Use replay mode, quick stage updates, and cached fallback |
| SQLite demo state gets messy | Results may differ between runs | Provide seed reset path or reinitialize before recording/demo |
| Trace UI lacks sponsor proof | Bright Data value may not be clear | Make Source Explorer trace rows demo-critical and populate live/replay/fallback rows |
| Scope expands into production features | MVP delivery slows | Exclude SSO, RBAC, integrations, full production scheduler, and broad intelligence surfaces |
