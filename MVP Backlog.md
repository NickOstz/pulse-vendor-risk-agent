# MVP Development Backlog

## P0 — Must Build

### 1. Define SQLite Schema and Seed Vendor Data

- **Priority:** P0
- **Owner type:** backend / data
- **Description:** Create the MVP persistence layer for vendors, autonomous review cycles, evidence, alerts, and Bright Data traces. Seed 5 demo vendors with exact domains, owners, criticality, renewal dates, source rules, and agent policy fields.
- **Dependencies:** None
- **Acceptance criteria:**
  - SQLite database includes `companies`, `scans`, `evidence_items`, `alerts`, and `brightdata_traces`.
  - `companies` includes `agent_enabled`, `agent_status`, `review_policy`, `last_agent_run_at`, and `next_agent_run_at`.
  - At least 5 vendors are seeded.
  - Demo vendor is marked critical with renewal within 60 days.
  - Raw snapshot paths can be referenced from scans and evidence items.
- **Estimated difficulty:** medium
- **Required for demo:** Yes

### 2. Build FastAPI Backend Skeleton

- **Priority:** P0
- **Owner type:** backend
- **Description:** Set up the FastAPI service with configuration, database connection, schema models, health check, and app structure.
- **Dependencies:** Define SQLite Schema and Seed Vendor Data
- **Acceptance criteria:**
  - FastAPI app runs locally.
  - Backend connects to SQLite.
  - Pydantic schemas exist for companies, scans, evidence, alerts, traces, and agent status.
  - Health check reports database, replay data, scheduler status, Bright Data key presence, and LLM key presence.
- **Estimated difficulty:** medium
- **Required for demo:** Yes

### 3. Implement Company and Agent APIs

- **Priority:** P0
- **Owner type:** backend
- **Description:** Implement vendor list/create APIs and the Vendor Risk Agent enable/disable API.
- **Dependencies:** Build FastAPI Backend Skeleton
- **Acceptance criteria:**
  - `GET /api/companies` returns seeded and created vendors.
  - `POST /api/companies` creates a vendor with required field validation.
  - `PATCH /api/companies/{company_id}/agent` enables or disables the Vendor Risk Agent.
  - Enabling the agent sets `agent_enabled = true` and `agent_status = active`.
  - For the demo vendor, enabling the agent sets `next_agent_run_at <= now`.
  - API returns review policy and next review time.
- **Estimated difficulty:** medium
- **Required for demo:** Yes

### 4. Implement Agent Scheduler and Tick Endpoint

- **Priority:** P0
- **Owner type:** backend
- **Description:** Add a lightweight autonomous scheduler that starts due review cycles. Include a demo-safe tick endpoint to force due-vendor checks.
- **Dependencies:** Implement Company and Agent APIs
- **Acceptance criteria:**
  - Scheduler finds vendors where `agent_enabled = true` and `next_agent_run_at <= now`.
  - Scheduler does not start duplicate review cycles for a vendor already running.
  - `GET /api/agents/status` returns active runs and due vendors.
  - `POST /api/agents/tick` checks due vendors and starts eligible review cycles.
  - Agent status changes to `running` when a review cycle starts.
- **Estimated difficulty:** medium
- **Required for demo:** Yes

### 5. Implement Review Cycle Status API

- **Priority:** P0
- **Owner type:** backend
- **Description:** Implement autonomous review-cycle creation, stage tracking, status polling, and review budget counters.
- **Dependencies:** Implement Agent Scheduler and Tick Endpoint
- **Acceptance criteria:**
  - A due agent run creates a `scans` row.
  - `GET /api/scans/{scan_id}` returns status and stage metrics.
  - Stages include Collect, Extract, Verify, Score, and Brief.
  - Status values include `queued`, `running`, `completed`, `failed`, and `completed_with_fallback`.
  - Review budgets are tracked: SERP queries, scraped URLs, live timeout, and LLM calls.
  - Polling every 2 seconds works without errors.
- **Estimated difficulty:** high
- **Required for demo:** Yes

### 6. Implement Replay Mode for Autonomous Review Cycles

- **Priority:** P0
- **Owner type:** backend / data
- **Description:** Add seeded replay data that produces a full autonomous review result without external service calls.
- **Dependencies:** Define SQLite Schema and Seed Vendor Data, Implement Review Cycle Status API
- **Acceptance criteria:**
  - Replay data includes demo vendor, traces, evidence, alerts, source excerpts, related-change card, and brief content.
  - Replay review cycle advances through the same stages as live mode.
  - Replay trace rows use `source_mode = cached`.
  - Frontend can render replay and live/fallback results through the same APIs.
- **Estimated difficulty:** medium
- **Required for demo:** Yes

### 7. Implement Bright Data Wrapper and Trace Logging

- **Priority:** P0
- **Owner type:** backend
- **Description:** Create one wrapper module for Bright Data SERP, markdown scraping, and Web Unlocker fallback. Log every collection operation.
- **Dependencies:** Build FastAPI Backend Skeleton, Define SQLite Schema and Seed Vendor Data
- **Acceptance criteria:**
  - SERP discovery path exists for targeted public queries.
  - Markdown scraping path exists for known public pages.
  - Web Unlocker fallback path exists for one tested public source type.
  - Every operation writes a `brightdata_traces` row.
  - Trace rows include scan ID, product, operation, URL, status, latency, retry count, error, and source mode.
  - Slow or failed demo-critical fetches can fall back after 8 seconds.
- **Estimated difficulty:** high
- **Required for demo:** Yes

### 8. Lock Live Demo Source and Cached Fallback

- **Priority:** P0
- **Owner type:** data / backend
- **Description:** Select the live Bright Data source used in the demo, store cached fallback payload, and define expected extracted evidence.
- **Dependencies:** Implement Bright Data Wrapper and Trace Logging, Implement Replay Mode for Autonomous Review Cycles
- **Acceptance criteria:**
  - Demo vendor is finalized.
  - One live public URL is selected and tested repeatedly.
  - Cached fallback payload is stored.
  - Expected evidence items and related-change card are represented in seed data.
  - Live failure or timeout produces clearly labeled cached/fallback trace telemetry.
- **Estimated difficulty:** medium
- **Required for demo:** Yes

### 9. Implement Structured Evidence Extraction

- **Priority:** P0
- **Owner type:** AI / backend
- **Description:** Add strict JSON extraction for the three MVP signal templates: trust/security, adverse media, and pricing/terms.
- **Dependencies:** Implement Review Cycle Status API
- **Acceptance criteria:**
  - Extraction supports the PRD evidence JSON schema.
  - Pydantic validates every extraction result before insert.
  - Malformed JSON is retried once with a simpler prompt.
  - On second failure, raw source is stored and no alert is created.
  - LLM calls respect the 20-call per-review budget.
- **Estimated difficulty:** high
- **Required for demo:** Yes

### 10. Implement Quote Verification

- **Priority:** P0
- **Owner type:** AI / backend
- **Description:** Verify whether supporting quotes appear in captured source text using exact matching and RapidFuzz token similarity.
- **Dependencies:** Implement Structured Evidence Extraction
- **Acceptance criteria:**
  - Source text and quote text are normalized before comparison.
  - Evidence is marked `verified` when exact match or fuzzy match score is above 0.8.
  - Weak, missing, or ambiguous quote support is marked `needs_review`.
  - `no_evidence` and `failed_source` states are supported.
  - Quote match score is stored with the evidence item.
- **Estimated difficulty:** medium
- **Required for demo:** Yes

### 11. Implement Deterministic Scoring and Alert Creation

- **Priority:** P0
- **Owner type:** backend / AI
- **Description:** Score verified evidence using the PRD formula and create high-priority alerts only from verified evidence.
- **Dependencies:** Implement Quote Verification
- **Acceptance criteria:**
  - Scoring uses BaseSeverity, SourceReliability, Confidence, Freshness, and VendorCriticality.
  - LLM confidence is capped at 0.95 for scoring.
  - Display score is capped at 100.
  - High-priority alerts are generated only from verified evidence.
  - Score factor data is stored for frontend explanation.
- **Estimated difficulty:** medium
- **Required for demo:** Yes

### 12. Implement Related-Change Card Rules

- **Priority:** P0
- **Owner type:** backend
- **Description:** Generate a related-change card when compatible verified signals appear for the same vendor in the same review window.
- **Dependencies:** Implement Deterministic Scoring and Alert Creation
- **Acceptance criteria:**
  - Rule checks same vendor, same review window, two or more verified signals, and compatible signal categories.
  - Demo vendor produces expected related-change card.
  - Card links to related evidence item IDs.
  - Card has concise reason text.
- **Estimated difficulty:** medium
- **Required for demo:** Yes

### 13. Implement Evidence, Alert, Trace, and Brief APIs

- **Priority:** P0
- **Owner type:** backend
- **Description:** Expose API endpoints needed by Command Center, Evidence Drawer, Source Explorer, quote view, and Vendor Risk Assessment Brief.
- **Dependencies:** Implement Deterministic Scoring and Alert Creation, Implement Bright Data Wrapper and Trace Logging
- **Acceptance criteria:**
  - `GET /api/alerts` returns prioritized alerts.
  - `PATCH /api/alerts/{alert_id}` supports approve, dismiss, and mark for review.
  - `GET /api/companies/{company_id}/evidence` returns evidence and source metadata.
  - `GET /api/brightdata/traces?scan_id=...` returns trace rows.
  - `POST /api/briefs/vendor-review` returns Markdown or HTML brief content.
- **Estimated difficulty:** high
- **Required for demo:** Yes

### 14. Build Frontend App Shell

- **Priority:** P0
- **Owner type:** frontend
- **Description:** Create the Next.js, React, TypeScript, and Tailwind app shell with shared layout and API client.
- **Dependencies:** None
- **Acceptance criteria:**
  - Frontend runs locally.
  - App includes Command Center, Evidence Drawer / Source Explorer, and Vendor Risk Assessment Brief surfaces.
  - Shared API client and frontend types are configured.
  - Layout is compact and appropriate for a GRC workflow.
- **Estimated difficulty:** medium
- **Required for demo:** Yes

### 15. Build Command Center with Agent Status

- **Priority:** P0
- **Owner type:** frontend
- **Description:** Build the primary dashboard showing vendors, renewal urgency, risk delta, latest alerts, and Vendor Risk Agent status.
- **Dependencies:** Build Frontend App Shell, Implement Company and Agent APIs
- **Acceptance criteria:**
  - Seeded vendors display in the Command Center.
  - Vendor cards show owner, criticality, renewal date, agent status, and latest alert summary.
  - Cards are sorted by renewal urgency, risk delta, agent status, and latest verified signals.
  - User can select the demo vendor.
- **Estimated difficulty:** medium
- **Required for demo:** Yes

### 16. Build Vendor Risk Agent Toggle and Status Panel

- **Priority:** P0
- **Owner type:** frontend
- **Description:** Build the primary control for enabling the Vendor Risk Agent and showing autonomous review status.
- **Dependencies:** Build Command Center with Agent Status, Implement Company and Agent APIs, Implement Agent Scheduler and Tick Endpoint
- **Acceptance criteria:**
  - User can toggle **Vendor Risk Agent** from Off to On.
  - Toggle calls `PATCH /api/companies/{company_id}/agent`.
  - Status panel shows monitoring mode, review policy, next review time, current activity, and latest assessment status.
  - Demo vendor shows next review as due now after enablement.
  - UI does not rely on a primary manual scan button for the demo flow.
- **Estimated difficulty:** medium
- **Required for demo:** Yes

### 17. Build Autonomous Review Status Strip and Polling

- **Priority:** P0
- **Owner type:** frontend
- **Description:** Add the review-cycle status strip and polling behavior for autonomous agent runs.
- **Dependencies:** Build Vendor Risk Agent Toggle and Status Panel, Implement Review Cycle Status API
- **Acceptance criteria:**
  - UI detects or receives active scan ID after agent starts.
  - UI polls `GET /api/scans/{scan_id}` every 2 seconds.
  - Stages show Collect, Extract, Verify, Score, and Brief.
  - Completed, failed, cached, and fallback states are distinguishable.
  - Stage progression is understandable to non-technical judges.
- **Estimated difficulty:** medium
- **Required for demo:** Yes

### 18. Build Evidence Drawer and Source Explorer

- **Priority:** P0
- **Owner type:** frontend
- **Description:** Build the evidence detail surface for alerts, source quotes, trace metadata, support status, confidence, score explanation, and source mode.
- **Dependencies:** Build Command Center with Agent Status, Implement Evidence, Alert, Trace, and Brief APIs
- **Acceptance criteria:**
  - User can open a high-priority alert.
  - Evidence drawer shows claim, quote, source URL, source type, captured date, severity, confidence, and support status.
  - Source Explorer shows Bright Data trace rows.
  - Trace rows display product, operation, status, latency, retry count, error, and source mode.
  - Score methodology is visible through compact explanation or tooltip.
- **Estimated difficulty:** high
- **Required for demo:** Yes

### 19. Build Side-by-Side Quote Verification View

- **Priority:** P0
- **Owner type:** frontend
- **Description:** Show the supporting quote next to the captured source text, with matched source text highlighted.
- **Dependencies:** Build Evidence Drawer and Source Explorer, Implement Quote Verification
- **Acceptance criteria:**
  - View shows extracted quote and source excerpt side by side.
  - Matched source text is highlighted.
  - Support state and quote-match score are visible.
  - View works for replay, live, cached, and fallback demo evidence.
- **Estimated difficulty:** medium
- **Required for demo:** Yes

### 20. Build Vendor Risk Assessment Brief

- **Priority:** P0
- **Owner type:** frontend / backend / AI
- **Description:** Generate and display a concise Vendor Risk Assessment Brief from verified evidence, with Markdown or HTML output.
- **Dependencies:** Implement Evidence, Alert, Trace, and Brief APIs, Build Frontend App Shell
- **Acceptance criteria:**
  - Brief includes summary, key verified changes, evidence table, risk interpretation, recommended action, suggested owner, and review status.
  - Brief is generated from verified evidence only.
  - User can view or export the brief as Markdown or HTML.
  - Brief is usable by a GRC lead without manual rewriting.
- **Estimated difficulty:** medium
- **Required for demo:** Yes

### 21. End-to-End Autonomous Demo Test

- **Priority:** P0
- **Owner type:** frontend / backend / AI / data
- **Description:** Validate the full demo path from agent enablement to autonomous review cycle, Bright Data proof, verified evidence, related-change card, and assessment brief.
- **Dependencies:** All P0 build tickets
- **Acceptance criteria:**
  - Demo completes in 3 minutes.
  - Agent starts a due review cycle after the toggle is enabled.
  - At least one live Bright Data fetch is shown or honestly falls back after timeout.
  - Every high-priority demo alert has verified quote support.
  - Related-change card appears for the demo vendor.
  - Vendor Risk Assessment Brief displays successfully.
  - No unfinished non-MVP surfaces are visible.
- **Estimated difficulty:** high
- **Required for demo:** Yes

## P1 — Should Build

### 22. Add Vendor Creation UI

- **Priority:** P1
- **Owner type:** frontend
- **Description:** Add a simple form for manually adding vendors to the watchlist.
- **Dependencies:** Build Command Center with Agent Status, Implement Company and Agent APIs
- **Acceptance criteria:**
  - User can add vendor with exact domain, relationship type, owner, criticality, renewal date, and source rules.
  - Required fields are validated client-side.
  - Created vendor appears in the Command Center.
- **Estimated difficulty:** medium
- **Required for demo:** No

### 23. Add Alert Review Actions

- **Priority:** P1
- **Owner type:** frontend / backend
- **Description:** Allow users to approve, dismiss, or mark alerts for review.
- **Dependencies:** Implement Evidence, Alert, Trace, and Brief APIs, Build Evidence Drawer and Source Explorer
- **Acceptance criteria:**
  - Alert status can be updated from the UI.
  - Status changes persist through `PATCH /api/alerts/{alert_id}`.
  - Updated status appears in alert list and evidence drawer.
- **Estimated difficulty:** medium
- **Required for demo:** No

### 24. Build Prompt Quality Evaluation Set

- **Priority:** P1
- **Owner type:** AI / data
- **Description:** Create and run the 5-page seeded evaluation set for extraction quality across trust/security, adverse media, and pricing/terms templates.
- **Dependencies:** Implement Structured Evidence Extraction, Implement Quote Verification
- **Acceptance criteria:**
  - Evaluation set includes examples across all three signal templates.
  - At least 4 of 5 pages produce one verified evidence item with quote-match score of at least 0.8.
  - If the quality gate fails, the two best-performing templates are identified.
- **Estimated difficulty:** medium
- **Required for demo:** No

### 25. Improve Source Allow/Block Rule UI

- **Priority:** P1
- **Owner type:** frontend / backend
- **Description:** Make vendor-specific source allow/block rules visible and editable from the selected vendor view.
- **Dependencies:** Implement Company and Agent APIs, Build Vendor Risk Agent Toggle and Status Panel
- **Acceptance criteria:**
  - Source rules can be stored and updated.
  - Review-cycle planning respects allow/block rules.
  - UI displays active source rules for selected vendor.
- **Estimated difficulty:** medium
- **Required for demo:** No

### 26. Add Demo Health Indicator

- **Priority:** P1
- **Owner type:** frontend / DevOps
- **Description:** Add a small internal readiness indicator for backend, database, scheduler, replay data, Bright Data key, and LLM key presence.
- **Dependencies:** Build FastAPI Backend Skeleton, Build Frontend App Shell
- **Acceptance criteria:**
  - UI can show whether demo dependencies are available.
  - Indicator is not prominent in the main demo flow.
  - Backend health endpoint powers the status.
- **Estimated difficulty:** low
- **Required for demo:** No

### 27. Deploy Frontend and Backend

- **Priority:** P1
- **Owner type:** DevOps
- **Description:** Deploy the frontend and backend with SQLite, environment variables, replay data, and health check.
- **Dependencies:** Build Frontend App Shell, Build FastAPI Backend Skeleton, Implement Replay Mode for Autonomous Review Cycles
- **Acceptance criteria:**
  - Frontend is deployed to Vercel or equivalent.
  - Backend is deployed to Railway or equivalent.
  - Environment variables are configured server-side.
  - Replay data is available in deployed environment.
  - Health check passes after deployment.
- **Estimated difficulty:** medium
- **Required for demo:** No

## P2 — Nice to Have

### 28. Add Watchlist-Level Agent Enablement

- **Priority:** P2
- **Owner type:** frontend / backend
- **Description:** Allow the user to enable the Vendor Risk Agent for the full seeded watchlist in one action.
- **Dependencies:** Implement Company and Agent APIs, Build Vendor Risk Agent Toggle and Status Panel
- **Acceptance criteria:**
  - User can enable monitoring for all seeded vendors.
  - Each vendor receives an appropriate review policy.
  - UI shows per-vendor agent status.
- **Estimated difficulty:** medium
- **Required for demo:** No

### 29. Add HTML Brief Styling Polish

- **Priority:** P2
- **Owner type:** frontend / design
- **Description:** Improve visual formatting of the HTML Vendor Risk Assessment Brief for sharing or printing.
- **Dependencies:** Build Vendor Risk Assessment Brief
- **Acceptance criteria:**
  - HTML brief has clear hierarchy and readable evidence table.
  - Styling does not introduce new workflow or content.
  - Markdown output remains available.
- **Estimated difficulty:** low
- **Required for demo:** No

### 30. Record Backup Demo Video

- **Priority:** P2
- **Owner type:** design / DevOps
- **Description:** Record a fallback demo video after the autonomous end-to-end flow is stable.
- **Dependencies:** End-to-End Autonomous Demo Test
- **Acceptance criteria:**
  - Backup video covers agent enablement, autonomous review, Bright Data proof, verified evidence, related-change card, and assessment brief.
  - Recording is accessible to the demo team.
  - Video can be used if live demo environment fails.
- **Estimated difficulty:** low
- **Required for demo:** No

## Recommended Build Order

1. Define SQLite schema and seed vendor data.
2. Build FastAPI backend skeleton.
3. Implement company and agent APIs.
4. Implement agent scheduler and tick endpoint.
5. Implement review-cycle status API.
6. Implement replay mode for autonomous review cycles.
7. Build frontend app shell.
8. Build Command Center with agent status.
9. Build Vendor Risk Agent toggle and status panel.
10. Build autonomous review status strip and polling.
11. Implement Bright Data wrapper and trace logging.
12. Lock live demo source and cached fallback.
13. Implement extraction, quote verification, scoring, and alerts.
14. Implement related-change card rules.
15. Implement evidence, alert, trace, and brief APIs.
16. Build Evidence Drawer, Source Explorer, and quote verification view.
17. Build Vendor Risk Assessment Brief.
18. Run end-to-end autonomous demo test.
19. Add P1 polish only after the full P0 demo path is stable.

## Critical Path

SQLite schema and agent fields → FastAPI skeleton → company and agent APIs → scheduler/tick → review-cycle status → replay mode → frontend Command Center → agent toggle/status panel → autonomous status polling → Bright Data wrapper and traces → extraction and quote verification → deterministic scoring and alerts → Evidence Drawer / Source Explorer → Vendor Risk Assessment Brief → end-to-end demo hardening.

The highest-risk items are autonomous behavior credibility, Bright Data live reliability, extraction quality, quote verification, and visible trace/evidence proof.

## What Can Be Mocked

- Non-demo vendors.
- Replay review-cycle results.
- Cached source snapshots.
- Related-change card for the curated demo vendor, as long as linked evidence exists.
- LLM brief wording in replay mode, as long as it is generated from the verified evidence structure.
- Watchlist-level agent enablement.
- Vendor creation UI, if seeded vendors are enough for the demo.
- Alert approve/dismiss workflow.
- Hosted deployment, if the local demo is reliable.
- HTML styling polish for the brief.

## What Must Be Real

- Vendor Risk Agent toggle and visible agent status.
- Due-now autonomous review behavior for the demo vendor.
- Scheduler or `agents/tick` mechanism that starts a due review cycle.
- Core SQLite data model for companies, scans, evidence, alerts, and Bright Data traces.
- At least one live Bright Data fetch attempt or an honestly labeled live attempt with fallback.
- Bright Data trace telemetry fields and source-mode labels.
- Captured source URL, timestamp, and source metadata for demo evidence.
- Quote verification using exact match or RapidFuzz.
- Support states, especially `verified` and `needs_review`.
- Deterministic scoring and capped 0 to 100 display score.
- High-priority alerts requiring verified evidence.
- Command Center to Evidence Drawer to Vendor Risk Assessment Brief flow.
- Demo fallback behavior when live collection fails or exceeds 8 seconds.
