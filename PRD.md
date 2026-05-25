# Product Requirements Document

## 1. Product Overview

**Product name:** Pulse: Autonomous Vendor Risk Agent

Pulse is an autonomous public-web evidence agent for third-party vendor risk. A GRC user configures critical vendors once, enables the Vendor Risk Agent, and Pulse runs bounded review cycles based on vendor criticality and renewal urgency.

The agent uses Bright Data to collect live public sources such as trust pages, security pages, privacy and terms pages, pricing pages, status pages, and targeted adverse-media search results. AI extracts structured evidence and drafts concise assessment language, while quote verification and risk scoring remain deterministic.

The MVP product promise is: here is what changed, here is the source, here is why it matters, and here is the vendor risk assessment your team can act on.

## 2. Target User

The primary user is a lean GRC, security, or third-party risk lead at a 200 to 800 employee SaaS, fintech, healthtech, ecommerce, or B2B software company.

This user manages 5 to 15 high-impact vendors and prepares vendor review notes for renewals, onboarding, security reviews, and audits. They do not usually have a dedicated analyst team, so they need defensible evidence and concise review artifacts.

Procurement is a close stakeholder, especially when pricing, packaging, terms, or renewal-relevant vendor changes are detected.

## 3. Problem Statement

Vendor risk teams discover important public vendor changes too late.

Common examples:

- A vendor updates its trust, privacy, security, or compliance page.
- A status page, breach mention, lawsuit, regulatory mention, or adverse-media result appears between formal reviews.
- A pricing, packaging, or terms page changes before renewal.
- A public source contains a review trigger, but no one checks it until an audit, outage, or renewal negotiation.

Existing alternatives are weak for this workflow:

- Annual questionnaires are stale by design.
- Google Alerts produce noisy, unaudited alerts.
- Manual analyst work is slow, inconsistent, and hard to reproduce.
- Enterprise intelligence platforms are often too expensive and broad for mid-market teams.

The core problem is not only finding pages. The product must autonomously investigate the right public sources, identify what changed, verify whether each claim is source-supported, and return a structured assessment before renewal or risk review.

## 4. Goals

- Let a GRC user enable an autonomous vendor risk agent for critical vendors.
- Automatically start bounded review cycles when vendors are due based on criticality and renewal urgency.
- Collect live public web evidence through Bright Data with visible trace telemetry.
- Extract vendor-risk signals into a strict structured format.
- Verify high-priority claims against captured source text.
- Score verified evidence with deterministic, explainable methodology.
- Generate a concise Vendor Risk Assessment Brief for security, procurement, or leadership.
- Keep the MVP narrow, reliable, and demo-ready.

## 5. Non-Goals

- Replace formal security reviews, legal review, private questionnaires, or procurement approval workflows.
- Monitor private, login-only, credentialed, or unauthorized sources.
- Build broad GTM intelligence, competitor intelligence, or general market monitoring.
- Build a fully open-ended agent that browses without source, budget, or schema limits.
- Build a multi-agent swarm or LangGraph workflow.
- Add Slack, email, Jira, ServiceNow, Teams, or procurement-system integrations in the MVP.
- Add SSO, RBAC, tenant isolation, audit retention, or custom scoring configuration.
- Perform open-ended company identity resolution.
- Treat AI-written summaries as verified evidence without quote support.

## 6. MVP Features

The MVP must prove one workflow: vendor watchlist to autonomous agent activation to Bright Data collection to verified evidence to scored risk assessment to vendor brief.

### Vendor Watchlist

- Manual watchlist for 5 to 10 vendors.
- Required fields:
  - exact domain,
  - relationship type,
  - business owner,
  - criticality,
  - renewal date.
- Optional source allow/block list per vendor.

### Vendor Risk Agent

- Vendor Risk Agent toggle for a selected vendor.
- Agent states:
  - `inactive`,
  - `active`,
  - `running`,
  - `completed`,
  - `needs_review`.
- Agent status panel showing:
  - monitoring mode,
  - review policy,
  - next review time,
  - current activity,
  - latest assessment status.
- Simple autonomous scheduler that starts due review cycles.
- Demo-safe due-now rule so the selected demo vendor starts automatically after the agent is enabled.
- Secondary **Run Review Now** fallback may exist for demo recovery, but it is not the primary flow.

### Review Policy

MVP review policy:

| Vendor Context | Agent Behavior |
|---|---|
| Critical vendor with renewal within 60 days | Review due now or daily |
| Critical vendor outside 60 days | Weekly review |
| Important vendor | Weekly review |
| Normal vendor | Manual or low-frequency review |
| Demo vendor | Review due immediately after agent is enabled |

### Review Budget

Each autonomous review cycle must enforce:

- maximum 6 SERP queries,
- maximum 12 URLs scraped,
- maximum 8-second live fetch timeout per demo-critical source,
- maximum 20 LLM extraction calls per review cycle.

### Bright Data Collection

- Bright Data SERP discovery for targeted public queries.
- Bright Data markdown scraping for known public pages.
- Web Unlocker fallback for one tested public source type.
- Bright Data trace logging visible in the UI.
- Trace telemetry labels source mode as `live`, `cached`, or `fallback`.

### Evidence Extraction and Verification

- Three signal templates:
  - trust/security,
  - adverse media,
  - pricing/terms.
- Strict JSON extraction.
- Pydantic validation before database insert.
- One retry for malformed JSON.
- RapidFuzz quote-match verification with default threshold of 0.8.
- Support states:
  - `verified`,
  - `needs_review`,
  - `no_evidence`,
  - `failed_source`.
- Unsupported or ambiguous evidence is excluded from high-confidence scoring.

### Scoring and Assessment

- Deterministic scoring with visible methodology.
- Final score displayed as a 0 to 100 index and capped at 100.
- High-priority alerts require verified evidence.
- Related-change card generated by rules when two or more compatible verified signals appear for the same vendor in the same review window.
- Vendor Risk Assessment Brief export as Markdown or HTML.

### Product Surfaces

- Command Center with sorted vendor cards, agent status, renewal urgency, risk delta, and latest alerts.
- Evidence Drawer / Source Explorer with source quotes, trace metadata, confidence, support status, and source mode.
- Side-by-side source quote view with matched quote highlighted.
- Vendor Risk Assessment Brief.

### Demo Safety

- Replay mode using seeded review-cycle results.
- One live Bright Data fetch during the demo.
- Automatic fallback to cached data if the live fetch exceeds 8 seconds or fails.

## 7. User Stories

- As a GRC lead, I want to add critical vendors with exact domains and renewal dates so Pulse can monitor the vendors that matter most.
- As a GRC lead, I want to enable the Vendor Risk Agent for a vendor so I do not have to manually run one-off searches.
- As a GRC lead, I want to see the agent status and next review time so I know whether a vendor is being monitored.
- As a GRC lead, I want the agent to automatically investigate vendors that are due for review before renewal.
- As a GRC lead, I want every high-priority alert to show a source URL, captured timestamp, quote, and support status so I can trust the evidence.
- As a GRC lead, I want unsupported claims marked as needing review so I do not act on weak AI output.
- As a procurement stakeholder, I want pricing or terms changes surfaced before renewal negotiation.
- As a demo judge, I want to see Bright Data trace telemetry so I can verify that live public-web evidence was collected.
- As a GRC lead, I want to export a concise vendor risk assessment brief so I can share findings with security, procurement, or leadership.

## 8. Acceptance Criteria

### Vendor Watchlist

- A user can view seeded vendors in the Command Center.
- A user can add a vendor with exact domain, relationship type, owner, criticality, renewal date, and optional source rules.
- The system prevents vendor creation when exact domain, owner, criticality, or renewal date is missing.

### Agent Activation

- A user can toggle **Vendor Risk Agent** on or off for a vendor.
- Enabling the agent stores `agent_enabled = true`.
- Agent status updates to `active` after enablement.
- Demo vendor receives a due-now review policy after enablement.
- Agent status panel shows monitoring mode, review policy, next review, current activity, and latest assessment result.

### Autonomous Review Cycle

- The scheduler finds vendors where `agent_enabled = true` and `next_agent_run_at <= now`.
- A due vendor starts an autonomous review cycle without the user clicking a scan button.
- Review-cycle stages include Collect, Extract, Verify, Score, and Brief.
- The frontend polls `GET /api/scans/{scan_id}` every 2 seconds while a cycle is active.
- Review budgets are enforced per review cycle.
- If a live demo fetch fails or exceeds 8 seconds, the system falls back to cached evidence and labels the source mode accurately.

### Bright Data Traceability

- Every Bright Data operation creates a trace record.
- Trace records include scan ID, product, operation, URL, status, latency, retry count, error, and source mode.
- The UI displays trace rows in the Evidence Drawer / Source Explorer.

### Evidence Quality

- LLM extraction output is validated with Pydantic before insert.
- Malformed JSON is retried once with a simpler prompt.
- Evidence items include claim, quote, source URL, source type, captured or published date, severity hint, confidence, and recommended action.
- Quote verification marks evidence as `verified` only when the quote is present by exact match or fuzzy match above 0.8.
- Weak, missing, or ambiguous quote support is marked `needs_review`.
- High-priority alerts are created only from verified evidence.

### Scoring

- Scores are calculated using deterministic scoring constants.
- The displayed score is capped at 100.
- The UI exposes the score methodology through a compact explanation or tooltip.
- Unsupported evidence does not contribute to high-confidence alert scoring.

### Brief Generation

- The user can generate or open a Vendor Risk Assessment Brief from verified evidence.
- The brief includes summary, key verified changes, evidence table, risk interpretation, recommended action, suggested owner, and review status.
- The brief can be exported as Markdown or HTML.

### Demo Reliability

- Replay mode can produce a full review-cycle result.
- One live Bright Data source is tested and available for the demo.
- Cached fallback data exists for the demo vendor.
- A related-change card is pre-seeded or rule-generated for the curated demo scenario.

## 9. Core User Flow

1. User opens the Command Center.
2. User reviews the vendor watchlist sorted by renewal urgency, risk delta, agent status, and latest verified signals.
3. User selects a critical vendor.
4. User toggles **Vendor Risk Agent** to On.
5. Pulse assigns a review policy based on criticality and renewal urgency.
6. For the demo vendor, `next_agent_run_at` is set to due now.
7. The scheduler detects that the vendor is due and starts an autonomous review cycle.
8. Pulse creates a bounded scan plan from fixed templates:
   - trust/security pages,
   - privacy/terms pages,
   - pricing/packaging pages,
   - status pages,
   - targeted adverse-media search queries.
9. Pulse collects public sources through Bright Data and stores snapshots, hashes, and trace records.
10. Pulse extracts structured evidence from relevant source sections.
11. Pulse verifies whether each supporting quote appears in the captured source text.
12. Pulse scores verified evidence and generates alert cards.
13. Pulse creates a related-change card when compatible verified signals appear in the same review window.
14. User opens an alert and reviews quote support, trace metadata, confidence, and score explanation.
15. User exports a Vendor Risk Assessment Brief for security, procurement, or leadership.

## 10. Data Requirements

Pulse collects only public web data.

### Source Categories

- Vendor-owned trust, security, privacy, terms, pricing, packaging, status, changelog, and product pages.
- Targeted public search results for breach, incident, lawsuit, regulatory, and adverse-media mentions.
- Public news or regulator pages discovered through targeted SERP queries.

### MVP Tables

| Table | Purpose |
|---|---|
| `companies` | Vendor identity, domain, relationship type, owner, criticality, renewal date, source rules, agent status fields |
| `scans` | Autonomous review-cycle status, started/completed timestamps, scan mode, content hashes, summary metrics |
| `evidence_items` | Extracted claims, quotes, source metadata, support status, confidence, severity |
| `alerts` | Prioritized vendor-risk signal cards, status, owner, score, recommended action |
| `brightdata_traces` | Product used, operation, source URL, status, latency, retry count, error, scan ID, source mode |

### Required Company Agent Fields

| Field | Purpose |
|---|---|
| `agent_enabled` | Whether the Vendor Risk Agent is active for this vendor |
| `agent_status` | `inactive`, `active`, `running`, `completed`, or `needs_review` |
| `review_policy` | Simple policy label such as `critical_renewal_due` or `weekly` |
| `last_agent_run_at` | Last autonomous review timestamp |
| `next_agent_run_at` | Next scheduled review timestamp |

### Evidence Item Schema

```json
{
  "vendor_id": "string",
  "signal_type": "trust_security | adverse_media | pricing_terms",
  "claim": "string",
  "supporting_quote": "string",
  "source_url": "string",
  "source_type": "string",
  "published_or_captured_at": "string",
  "severity_hint": "low | medium | high",
  "confidence": 0.0,
  "recommended_action": "string"
}
```

### Data Controls

- Exact vendor domain is required.
- No open-ended company identity resolution.
- Source allow/block lists limit noise and cost.
- Content hashes prevent duplicate processing.
- Captured timestamps and source URLs are retained for every evidence item.
- Raw markdown snapshots are stored as local files or object blobs referenced from scans and evidence items.
- Personal data collection is minimized.
- Login-only, private, credentialed, or unauthorized sources are out of scope.

## 11. AI/Agent Requirements

Pulse uses a bounded autonomous agent workflow, not an open-ended agent swarm.

The agent has autonomy inside strict limits:

- fixed source categories,
- fixed review budgets,
- fixed Bright Data tools,
- fixed output schema,
- deterministic verification,
- deterministic scoring.

### Agent Trigger

The agent starts when a vendor is due for review.

Inputs:

- `agent_enabled`,
- `last_agent_run_at`,
- `next_agent_run_at`,
- renewal date,
- criticality,
- source rules.

The MVP may use a lightweight in-process scheduler or `POST /api/agents/tick` for demo-safe scheduler triggering.

### Stage 1: Collect

Collect is mostly deterministic.

Inputs:

- vendor domain,
- source rules,
- renewal date,
- criticality,
- scan budget.

Bright Data actions:

- SERP API for targeted discovery queries such as vendor name plus "trust," "security," "SOC 2," "pricing," "terms," "incident," "breach," and "lawsuit."
- MCP `scrape_as_markdown` for known public pages.
- Web Unlocker only as a fallback for blocked public pages.

Outputs:

- captured markdown/text,
- source URL,
- content hash,
- source type,
- capture time,
- Bright Data trace record.

### Stage 2: Extract and Verify

The MVP supports three extraction templates:

- Trust, security, compliance, and privacy posture changes.
- Adverse-media, breach, outage, lawsuit, or regulatory mentions from public sources.
- Pricing, packaging, terms, or renewal-relevant page changes.

Model requirements:

- Default extraction and brief wording model: DeepSeek V4 Flash.
- Escalation model for messy pages, failed extraction retries, or low-confidence evidence: DeepSeek V4 Pro.
- Fallback model if DeepSeek access, latency, or reliability blocks the demo: GPT-5.4-mini.

Validation requirements:

- LLM output must use the strict evidence JSON schema.
- Pydantic validates every response before insert.
- Malformed JSON is retried once with a simpler extraction prompt.
- On second failure, store the raw source and create no alert.

Verification requirements:

- Normalize source text and supporting quote.
- Use RapidFuzz token similarity for quote matching.
- Mark evidence as `verified` if quote support is exact or above 0.8 similarity.
- Mark evidence as `needs_review` if the quote is missing, weak, or ambiguous.

Quality gate:

- At least 4 of 5 seeded test pages must produce one verified evidence item with quote-match score of at least 0.8 by the end of Day 3.
- If this gate is not met, reduce the MVP to the two best-performing signal templates.

### Stage 3: Score and Assess

The LLM may write concise summary text, but it must not assign risk scores.

Scoring formula:

`SignalScore = BaseSeverity * SourceReliability * Confidence * Freshness * VendorCriticality`

Default values:

| Factor | MVP Rule |
|---|---|
| BaseSeverity | high = 0.9, medium = 0.6, low = 0.3 |
| SourceReliability | vendor-owned source = 0.9, reputable news or regulator = 0.8, general web source = 0.5 |
| Confidence | LLM confidence from validated extraction, capped at 0.95 |
| Freshness | `exp(-0.1 * age_days)`, using captured date when published date is missing |
| VendorCriticality | critical = 1.2, important = 1.0, normal = 0.8 |

Display score:

`DisplayScore = min(100, round(SignalScore * 100))`

Related-change cards are rule-based:

- same vendor,
- same review window,
- two or more verified signals,
- compatible signal categories.

## 12. Technical Requirements

### Frontend

- Next.js.
- React.
- TypeScript.
- Tailwind CSS.
- Three surfaces only:
  - Command Center,
  - Evidence Drawer / Source Explorer,
  - Vendor Risk Assessment Brief.
- Primary control is **Vendor Risk Agent** toggle.
- Agent status panel shows monitoring mode, review policy, next review, current activity, and latest assessment result.
- Poll `GET /api/scans/{scan_id}` every 2 seconds for active review-cycle status.
- Show compact severity badges, source chips, trace rows, and source-mode labels.
- Include scoring methodology tooltip.
- Include side-by-side quote verification view with highlighted matched source text.

### Backend

- Python FastAPI.
- SQLite for MVP persistence.
- SQLAlchemy or SQLModel with Pydantic schemas.
- Lightweight in-process scheduler for autonomous review cycles.
- Explicit async task graph:
  - check due vendors,
  - collect sources,
  - extract and verify evidence,
  - score and generate alerts,
  - render risk assessment brief.
- Server-side environment variables for Bright Data and LLM credentials.
- JSON seed files for replay mode.

### Bright Data Integration

- One wrapper module handles all Bright Data calls and trace logging.
- SERP API performs targeted discovery.
- MCP `scrape_as_markdown` captures known public pages.
- Web Unlocker is used as a fallback only.
- Each call writes to `brightdata_traces`.

### API Surface

| Endpoint | Purpose |
|---|---|
| `GET /api/companies` | List vendors |
| `POST /api/companies` | Add vendor |
| `PATCH /api/companies/{company_id}/agent` | Enable or disable Vendor Risk Agent and update review policy |
| `GET /api/agents/status` | Show active agent runs and due vendors |
| `POST /api/agents/tick` | Demo-safe scheduler tick to start due autonomous review cycles |
| `POST /api/scans/run` | Fallback-only endpoint to start a review cycle manually if demo recovery is needed |
| `GET /api/scans/{scan_id}` | Poll autonomous review-cycle status and stage metrics |
| `GET /api/alerts` | List prioritized alerts |
| `PATCH /api/alerts/{alert_id}` | Approve, dismiss, or mark for review |
| `GET /api/companies/{company_id}/evidence` | Fetch evidence and source metadata |
| `GET /api/brightdata/traces?scan_id=...` | Fetch trace rows |
| `POST /api/briefs/vendor-review` | Generate vendor risk assessment brief |

### Deployment

- Next.js frontend on Vercel.
- FastAPI backend plus SQLite on Railway.
- Seeded replay data committed to the demo environment.
- Health check endpoint verifies Bright Data key, LLM key, database access, scheduler status, and replay data availability.

## 13. Demo Requirements

The demo should be 3 minutes and centered on one concrete story:

SecurePay is a mid-market fintech with a critical database vendor renewal in 45 days. The GRC lead needs to know whether anything public changed since the last review before procurement signs the renewal.

Before implementation starts, lock:

- demo vendor,
- live Bright Data URL,
- cached fallback payload,
- expected evidence items,
- expected related-change card.

### Demo Flow

1. Hook: Explain that vendor reviews are annual, but vendor posture changes any week.
2. Command Center: Show SecurePay's watchlist sorted by renewal urgency, risk delta, and agent status.
3. Enable Agent: Toggle **Vendor Risk Agent** from Off to On.
4. Agent Status: Show monitoring mode `autonomous`, review policy `critical vendor, renewal within 60 days`, and next review `due now`.
5. Autonomous Review Cycle: Without clicking a scan button, show the status strip moving through Collect, Extract, Verify, Score, and Brief.
6. Bright Data Proof: Show one live Bright Data fetch and trace rows for SERP, scrape, fallback status, latency, captured timestamp, source mode, and extracted evidence count.
7. Evidence Moment: Open a high-priority alert and show the matched quote, support status, confidence, score explanation, and renewal relevance.
8. Related Change Card: Show two compatible verified signals in the same review window.
9. Vendor Risk Assessment Brief: Show summary, evidence, risk interpretation, owner, and next action.
10. Close: Position Pulse as a Bright Data-powered autonomous evidence agent for continuous vendor risk review.

### Demo Safety

- All demo vendors are prewarmed.
- The demo vendor is configured so the next autonomous review is due immediately after the agent toggle is enabled.
- The live Bright Data call targets one repeatedly tested page.
- If the live call fails or exceeds 8 seconds, the UI falls back to cached evidence and labels the source mode.
- A recorded backup demo is prepared.
- A secondary **Run Review Now** control may exist for recovery, but it should not be the primary demo interaction.

## 14. Success Metrics

### MVP Success

- A user can enable the Vendor Risk Agent for a vendor.
- The demo vendor automatically starts a due review cycle after the agent is enabled.
- A user can complete the full workflow from agent activation to exported assessment brief.
- Every high-priority alert shown in the demo has verified quote support.
- The demo shows at least one live Bright Data fetch or an honestly labeled live attempt with fallback.
- The final assessment brief is usable by a GRC lead without manual rewriting.

### Evidence Quality

- At least 4 of 5 seeded test pages produce one verified evidence item with quote-match score of at least 0.8.
- Unsupported AI claims are labeled `needs_review` and excluded from high-priority scoring.
- No high-priority alert is generated without source URL, captured timestamp, and quote support.

### Demo Quality

- The end-to-end demo can be completed in 3 minutes.
- The autonomous review cycle is visibly started by agent due status, not by a primary manual scan button.
- Trace telemetry clearly distinguishes `live`, `cached`, and `fallback` sources.
- The agent status timeline makes the autonomous behavior understandable to non-technical judges.

## 15. Risks and Assumptions

| Risk | Why It Matters | Mitigation |
|---|---|---|
| Autonomous behavior feels fake | The hackathon track rewards agentic systems. | Use a real scheduler or `agents/tick`, due-now review policy, visible agent status, and automatic stage progression after enabling the agent. |
| Extraction quality is weak | Product value depends on accurate evidence extraction. | Limit MVP to three templates, use structured output, validate with Pydantic, tune against seeded pages, and drop to two templates if the quality gate fails. |
| Unsupported AI claims | False vendor-risk claims damage trust. | Require quote matching for high-priority alerts and label weak evidence as `needs_review`. |
| Live Bright Data call fails | A stalled demo damages credibility. | Prewarm demo cycles, test one known-good live page, use an 8-second timeout, and fall back to labeled cached data. |
| Demo feels too mocked | Judges may doubt the system is real. | Show trace rows, live fetch status, captured timestamps, source URLs, source mode, raw quote support, and agent activity timeline. |
| Public data is incomplete | Some vendor risk is hidden behind private portals. | Position Pulse as a public-web trigger layer that complements formal questionnaires. |
| Scope creep | Extra personas and pages can prevent completion. | Keep one persona, three UI surfaces, three signal templates, and one bounded autonomous agent workflow. |
| Scores seem arbitrary | Uncalibrated risk scores invite skepticism. | Show scoring constants, cap display score at 100, and expose top contributing evidence. |
| Noisy alerts | Users may stop trusting the feed. | Use source allow/block lists, content hashes, confidence thresholds, and dismissal feedback. |
| Company ambiguity | Wrong source matching creates false positives. | Require exact domain and use only preselected demo vendors in MVP. |
| Costs grow with review volume | Bright Data and LLM costs affect product viability. | Use strict URL budgets, hash-based dedupe, cached LLM responses during development, and cadence limits. |
| Compliance and privacy concerns | Risk products must avoid overclaiming. | Collect only public company-level data and label outputs as review signals, not legal conclusions. |

### Assumptions

- Users can provide exact vendor domains for monitored vendors.
- Public vendor pages and public search results contain enough signal to create review triggers.
- Bright Data access is available for SERP, markdown scraping, and one Web Unlocker fallback path.
- Seeded replay data is acceptable for demo reliability when live services fail.
- SQLite is sufficient for the hackathon MVP.
- A lightweight scheduler or demo-safe agent tick is enough to demonstrate autonomous behavior.
