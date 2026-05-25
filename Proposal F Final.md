# Proposal F Final

## 1. Product Name

Pulse: Autonomous Vendor Risk Agent

## 2. One-Sentence Pitch

Pulse is an autonomous vendor risk agent that monitors live public web sources with Bright Data, verifies source-backed risk signals, and returns structured vendor risk assessments before renewal, onboarding, or audit.

## 3. Executive Summary

Mid-market security and GRC teams do not need another broad intelligence dashboard. They need a reliable way to know when important vendors change in ways that should trigger review.

Pulse is an autonomous public-web evidence agent for third-party risk. A user adds critical vendors, enables the Vendor Risk Agent, and Pulse independently runs bounded review cycles based on renewal urgency and vendor criticality. The agent uses Bright Data to collect live public sources such as trust pages, pricing pages, terms pages, status pages, and targeted adverse-media search results.

AI is used for structured extraction and concise risk-assessment wording. High-priority claims must be tied to captured sources and verified quotes. Risk scoring is deterministic and transparent.

The product promise is: "Here is what changed, here is the source, here is why it matters, and here is the risk assessment your team can act on."

The MVP succeeds if it proves one measurable loop: a GRC user enables an autonomous vendor risk agent, the agent investigates live public web sources, verifies evidence, scores risk, and returns a structured vendor review brief without the user manually running a one-off search.

## 4. Target User

The primary user is a lean GRC, security, or third-party risk lead at a 200 to 800 employee SaaS, fintech, healthtech, ecommerce, or B2B software company.

This user owns 5 to 15 high-impact vendors and prepares vendor review notes for renewals, onboarding, security reviews, and audits. They usually do not have a dedicated analyst team. They need defensible evidence, not generic summaries.

The buying center is security/GRC, with procurement as a close stakeholder. GTM, competitor intelligence, and broad market monitoring are future expansions, not MVP personas.

## 5. Problem

Vendor risk teams discover important public changes too late.

Common examples:

- A vendor updates its trust, privacy, or security page after a posture change.
- A status page, breach mention, lawsuit, regulatory mention, or adverse-media result appears between formal reviews.
- A pricing, packaging, or terms page changes before renewal.
- A public source contains a review trigger, but no one checks it until an audit, outage, or renewal negotiation.

Current alternatives are weak for this workflow:

- Annual questionnaires are stale by design.
- Google Alerts produce noisy, unaudited alerts.
- Manual analyst work is slow, inconsistent, and hard to reproduce.
- Enterprise intelligence platforms are often too expensive and broad for mid-market teams.

The pain is not just finding pages. The pain is having an autonomous system investigate the right public sources, determine what changed, verify whether the claim is source-supported, and return a structured assessment before a renewal or risk review.

## 6. Solution

Pulse is an autonomous vendor-risk review agent built on live public web evidence.

A user enters a vendor name, exact domain, relationship type, criticality, renewal date, business owner, and optional source allow/block list. The user enables the Vendor Risk Agent for that vendor. From there, Pulse runs bounded autonomous review cycles based on simple policy rules, such as vendor criticality and renewal urgency.

During each review cycle, Pulse creates a scan plan from fixed templates, collects current public sources through Bright Data, extracts structured evidence, verifies quote support, scores verified risk signals, and generates a structured vendor risk assessment.

The MVP product experience has three core surfaces:

- **Command Center:** sorted vendors by risk delta, renewal urgency, agent status, and latest verified signals.
- **Evidence Drawer and Source Explorer:** source URLs, captured timestamps, Bright Data method, trace status, quotes, confidence, support flags, and live/replay/fallback status.
- **Vendor Risk Assessment Brief:** a concise Markdown/HTML brief showing what changed, why it matters, evidence links, recommended owner, and next action.

Pulse does not replace formal security reviews, legal review, or private questionnaires. It provides autonomous public-web triggers that tell the team when a deeper review is needed.

## 7. Core Workflow

1. The user adds 5 to 10 critical vendors with exact domains, relationship type, business owner, criticality, renewal date, and source rules.
2. The user enables **Vendor Risk Agent** for the vendor watchlist or for a selected critical vendor.
3. Pulse assigns a simple review policy based on criticality and renewal urgency:
   - critical vendor with renewal within 60 days: due now or daily,
   - critical vendor outside 60 days: weekly,
   - important vendor: weekly,
   - normal vendor: manual or lower frequency.
4. The agent scheduler checks which vendors are due for review.
5. When a vendor is due, the agent automatically starts a bounded autonomous review cycle.
6. Pulse creates a scan plan from fixed templates: trust/security pages, privacy/terms pages, pricing/packaging pages, status pages, and targeted adverse-media search queries.
7. Pulse collects current public sources through Bright Data, stores snapshots and trace records, and compares content hashes against previous scans.
8. The extraction stage converts relevant page sections into structured evidence items with claim, quote, source URL, signal type, severity hint, and confidence.
9. The verification step checks whether the quoted evidence is present in the captured source text.
10. Verified items can generate high-priority alerts. Unsupported items are flagged as `needs_review` and excluded from high-confidence scoring.
11. Pulse calculates vendor-level risk deltas, creates signal cards, and groups related verified evidence into a related-change card when multiple signals concern the same vendor and review window.
12. The user opens the evidence, approves or dismisses the recommendation, and exports a vendor risk assessment brief for security, procurement, or leadership.

## 8. MVP Feature Set

The MVP must prove one workflow: vendor watchlist to autonomous agent activation to Bright Data collection to verified evidence to scored risk assessment to vendor review brief.

Build these features:

- Manual vendor watchlist for 5 to 10 vendors.
- Required exact domain, criticality, owner, relationship type, and renewal date.
- Vendor Risk Agent toggle with states:
  - `inactive`,
  - `active`,
  - `running`,
  - `completed`,
  - `needs_review`.
- Simple autonomous scheduler that starts due review cycles.
- Agent status panel showing:
  - monitoring mode,
  - review policy,
  - next review time,
  - current activity,
  - latest assessment status.
- Demo-safe due-now rule so the selected demo vendor starts automatically after the agent is enabled.
- Optional hidden or secondary **Run Review Now** fallback for demo recovery.
- Source allow/block list per vendor.
- Hard scan budget per vendor:
  - maximum 6 SERP queries,
  - maximum 12 URLs scraped,
  - maximum 8-second live fetch timeout per demo-critical source,
  - maximum 20 LLM extraction calls per review cycle.
- Bright Data SERP discovery for targeted queries.
- Bright Data markdown scraping for known public pages.
- Web Unlocker fallback for one tested public source type.
- Bright Data trace logging visible in the UI.
- Trace telemetry that labels source mode as `live`, `cached`, or `fallback`.
- Three signal templates: trust/security, adverse media, pricing/terms.
- Strict JSON extraction with Pydantic validation.
- Quote-match verification using RapidFuzz with a default similarity threshold of 0.8.
- Support states: `verified`, `needs_review`, `no_evidence`, and `failed_source`.
- Deterministic scoring with visible methodology.
- Final score displayed as a 0 to 100 index, capped at 100.
- Command Center with sorted vendor cards, agent status, and latest alerts.
- Evidence drawer with source quotes and trace metadata.
- Side-by-side source quote view with matched quote highlighted.
- Vendor Risk Assessment Brief export as Markdown or HTML.
- Replay mode using seeded review-cycle results.
- One live Bright Data fetch during the demo, with automatic fallback to cached data if it exceeds 8 seconds or fails.

## 9. AI/Agent System

Pulse uses a bounded autonomous agent workflow, not an open-ended agent swarm and not LangGraph.

The agent has autonomy inside strict enterprise-safe limits:

- fixed source categories,
- fixed scan budget,
- fixed tools,
- fixed output schema,
- deterministic verification,
- deterministic scoring.

This lets the product satisfy the hackathon's AI-agent requirement while remaining reliable and buildable.

### Agent Trigger

The agent starts when a vendor is due for review.

Inputs:

- `agent_enabled`,
- `last_agent_run_at`,
- `next_agent_run_at`,
- renewal date,
- criticality,
- source rules.

MVP review policy:

| Vendor Context | Agent Behavior |
|---|---|
| Critical vendor with renewal within 60 days | Review due now or daily |
| Critical vendor outside 60 days | Weekly review |
| Important vendor | Weekly review |
| Normal vendor | Manual or low-frequency review |
| Demo vendor | Review due immediately after agent is enabled |

For the demo video, the user toggles **Vendor Risk Agent: On**. Since the demo vendor is due now, the autonomous review cycle starts without the user clicking a scan button.

### Stage 1: Collect

This stage is mostly deterministic.

Input:

- vendor domain,
- source rules,
- renewal date,
- criticality,
- scan budget.

Bright Data actions:

- SERP API for targeted discovery queries such as vendor name plus "trust," "security," "SOC 2," "pricing," "terms," "incident," "breach," and "lawsuit."
- MCP `scrape_as_markdown` for known public pages.
- Web Unlocker only as a fallback for blocked public pages.

Output:

- captured markdown/text,
- source URL,
- content hash,
- source type,
- capture time,
- Bright Data trace record.

### Stage 2: Extract and Verify

The MVP narrows extraction to three signal templates:

- Trust, security, compliance, and privacy posture changes.
- Adverse-media, breach, outage, lawsuit, or regulatory mentions from public sources.
- Pricing, packaging, terms, or renewal-relevant page changes.

Default LLM: DeepSeek V4 Flash, because the MVP needs low-cost, low-latency JSON extraction across many scraped pages. Escalation model: DeepSeek V4 Pro for messy pages, failed extraction retries, or low-confidence evidence. OpenAI fallback: GPT-5.4-mini if DeepSeek API access, latency, or reliability becomes a blocker during the demo.

The LLM must return a strict JSON schema validated by Pydantic:

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

DeepSeek JSON Output ensures valid JSON, but it is not treated as a substitute for downstream schema validation. The MVP still validates every response with Pydantic before insert.

Verification is programmatic:

- Normalize source text and supporting quote.
- Use RapidFuzz token similarity for quote matching.
- Require exact match or fuzzy match above 0.8 similarity.
- Mark the item `verified` if the quote is present.
- Mark the item `needs_review` if the quote is missing, weak, or ambiguous.
- Retry malformed JSON once with a simpler extraction prompt.
- On second failure, store the raw source and create no alert.

Prompt tuning uses 5 known test pages across trust/security, pricing/terms, and adverse-media examples. The quality gate is: at least 4 of 5 seeded pages must produce one verified evidence item with quote-match score of at least 0.8 by the end of Day 3. If not, reduce the MVP to the two best-performing signal templates.

### Stage 3: Score and Assess

Scoring is deterministic and transparent. The LLM may write concise summary text, but it does not assign the score.

MVP scoring:

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

High-priority alerts require verified evidence. Related-change cards are generated by rules: same vendor, same review window, two or more verified signals, and compatible signal categories.

The vendor risk assessment brief is template-first:

- Summary.
- Key verified changes.
- Evidence table.
- Risk interpretation.
- Recommended action.
- Suggested owner.
- Review status.

## 10. Data Pipeline

Pulse collects only public web data.

MVP source categories:

- Vendor-owned trust, security, privacy, terms, pricing, packaging, status, changelog, and product pages.
- Targeted public search results for breach, incident, lawsuit, regulatory, and adverse-media mentions.
- Public news or regulator pages when discovered by targeted SERP queries.

MVP storage uses five primary tables plus agent fields on companies:

| Table | Purpose |
|---|---|
| `companies` | Vendor identity, domain, relationship type, owner, criticality, renewal date, source rules, agent status fields |
| `scans` | Autonomous review-cycle status, started/completed timestamps, scan mode, content hashes, summary metrics |
| `evidence_items` | Extracted claims, quotes, source metadata, support status, confidence, severity |
| `alerts` | Prioritized vendor-risk signal cards, status, owner, score, recommended action |
| `brightdata_traces` | Product used, operation, source URL, status, latency, retry count, error, scan ID, source mode |

Required agent fields on `companies`:

| Field | Purpose |
|---|---|
| `agent_enabled` | Whether the Vendor Risk Agent is active for this vendor |
| `agent_status` | `inactive`, `active`, `running`, `completed`, or `needs_review` |
| `review_policy` | Simple policy label such as `critical_renewal_due` or `weekly` |
| `last_agent_run_at` | Last autonomous review timestamp |
| `next_agent_run_at` | Next scheduled review timestamp |

Raw markdown snapshots are stored as local files or object blobs referenced from `scans` and `evidence_items`. For the hackathon MVP, SQLite is sufficient; PostgreSQL is a future production migration.

Data controls:

- Exact vendor domain is required.
- No open-ended company identity resolution in the MVP.
- Source allow/block lists limit noise and cost.
- Content hashes prevent duplicate processing.
- Captured timestamps and source URLs are retained for every evidence item.
- Personal data collection is minimized.
- Login-only, private, credentialed, or unauthorized sources are out of scope.

## 11. Technical Architecture

### Frontend

- Next.js, React, TypeScript, and Tailwind CSS.
- Three surfaces only:
  - Command Center.
  - Evidence Drawer / Source Explorer.
  - Vendor Risk Assessment Brief.
- Primary control is **Vendor Risk Agent** toggle, not a scan button.
- Agent status panel shows:
  - monitoring mode,
  - review policy,
  - next review,
  - current activity,
  - latest assessment result.
- Poll `GET /api/scans/{scan_id}` every 2 seconds for active autonomous review-cycle status.
- Use compact, high-density UI with clear severity badges, source chips, trace rows, and source-mode labels.
- Include a scoring methodology tooltip rather than a separate analytics page.
- Include a side-by-side quote verification view with highlighted matched source text.

### Backend

- Python FastAPI.
- SQLite for MVP persistence.
- SQLAlchemy or SQLModel with Pydantic schemas.
- Lightweight in-process scheduler for autonomous review cycles.
- Explicit async task graph:
  1. check due vendors,
  2. collect sources,
  3. extract and verify evidence,
  4. score and generate alerts,
  5. render risk assessment brief.
- Server-side environment variables for Bright Data and LLM credentials.
- JSON seed files for replay mode.

### Autonomous Scheduler

The scheduler is intentionally simple for the MVP.

Implementation options:

- FastAPI startup background loop that checks due vendors every 30 seconds.
- `POST /api/agents/tick` endpoint for demo-safe manual scheduler triggering if needed.

The scheduler:

- finds vendors where `agent_enabled = true`,
- checks whether `next_agent_run_at <= now`,
- starts a review cycle if no review is already running,
- updates `agent_status`,
- sets the next review timestamp after completion.

### Bright Data Integration

- One wrapper module handles all Bright Data calls and trace logging.
- SERP API performs targeted discovery.
- MCP `scrape_as_markdown` captures known public pages.
- Web Unlocker is used as a fallback, not the default path.
- Each call writes `brightdata_traces` with scan ID, product, operation, URL, status, latency, retry count, error, and source mode.

### AI Implementation

- DeepSeek V4 Flash as the default extraction and brief-generation model.
- DeepSeek V4 Pro as the escalation model for messy pages, failed extraction retries, or low-confidence evidence.
- GPT-5.4-mini as the OpenAI fallback if DeepSeek access, latency, or reliability becomes a blocker.
- Three extraction prompts aligned to the MVP signal templates.
- Pydantic validation before database insert.
- One retry on malformed JSON.
- RapidFuzz quote verification before high-priority alert creation.
- Brief generation uses a fixed template with LLM-assisted wording only after evidence is validated.

### Minimal API Surface

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
- No separate managed database for the MVP.
- Seeded replay data committed to the demo environment.
- Health check endpoint verifies Bright Data key, LLM key, database access, scheduler status, and replay data availability.

## 12. Demo Script

The demo should be 3 minutes and centered on one concrete story.

### Demo Narrative

SecurePay is a mid-market fintech with Cloudflare as a critical edge-security vendor renewing in 45 days. The GRC lead needs to know which public compliance, commercial-scope, or operational signals require review before procurement signs the renewal.

Before implementation starts, lock:

- demo vendor,
- live Bright Data URL,
- cached fallback payload,
- expected evidence items,
- expected related-change card.

### Flow

1. **Hook, 20 seconds:** "Vendor reviews are annual, but vendor posture changes any week. Pulse is an autonomous vendor risk agent that tells a lean GRC team what changed before renewal, with evidence."
2. **Command Center, 25 seconds:** Show SecurePay's vendor watchlist sorted by renewal urgency, risk delta, and agent status. Open Cloudflare, the critical edge-security vendor.
3. **Enable Agent, 30 seconds:** Toggle **Vendor Risk Agent** from Off to On. The panel shows: monitoring mode `autonomous`, review policy `critical vendor, renewal within 60 days`, next review `due now`.
4. **Autonomous Review Cycle, 35 seconds:** Without clicking a scan button, the status strip changes to Collect, Extract, Verify, Score, Brief. The UI polls review-cycle status rather than using WebSockets.
5. **Bright Data Proof, 35 seconds:** Open Source Explorer. Show the live Bright Data fetch for one known-good page, plus trace rows for SERP, scrape, fallback status, latency, captured timestamp, source mode, and extracted evidence count.
6. **Evidence Moment, 45 seconds:** Open a high-priority alert. Show the side-by-side source quote view with the matched quote highlighted, support status, confidence, score explanation, and why it matters before renewal.
7. **Related Change Card, 20 seconds:** Show the pre-seeded or rule-based related-change card with two compatible verified signals in the same review window, such as a trust-page update plus an adverse-media result.
8. **Vendor Risk Assessment Brief, 30 seconds:** Generate or open the brief. It should read like something a GRC lead could send to procurement: summary, evidence, risk interpretation, owner, and next action.
9. **Close, 20 seconds:** "Pulse is not a chatbot and not alert spam. It is a Bright Data-powered autonomous evidence agent for continuous vendor risk review."

Demo safety:

- All demo vendors are prewarmed.
- The demo vendor is configured so the next autonomous review is due immediately after the agent toggle is enabled.
- The live Bright Data call targets one page tested repeatedly before presenting.
- If the live call fails or exceeds 8 seconds, the UI falls back to cached evidence and labels the source mode in trace telemetry.
- A recorded backup demo is prepared.
- A secondary **Run Review Now** control may exist for recovery, but it should not be the primary demo interaction.

## 13. Build Plan

### Day 1: Product Spine and Data Model

- Finalize signal taxonomy and scoring constants.
- Create SQLite schema and seed 5 vendors.
- Add agent fields to vendor records: `agent_enabled`, `agent_status`, `review_policy`, `last_agent_run_at`, `next_agent_run_at`.
- Lock the demo vendor, live URL, fallback data, expected evidence items, and related-change card.
- Build static Command Center with seeded alerts and agent status.
- Define JSON schemas for evidence items, scans, alerts, traces, and agent status.

### Day 2: Bright Data, Replay, and Agent Trigger

- Implement Bright Data wrapper.
- Add SERP, markdown scrape, and Web Unlocker fallback paths.
- Store trace logs and raw snapshots.
- Add trace source mode: `live`, `cached`, or `fallback`.
- Build replay mode from seeded JSON.
- Implement lightweight scheduler or `agents/tick` endpoint.
- Add Vendor Risk Agent toggle and due-now demo behavior.
- Test the live demo URL repeatedly and choose the most reliable page.

### Day 3: Extraction, Verification, and Scoring

- Implement three structured extraction prompts.
- Add Pydantic validation and one retry path.
- Add RapidFuzz quote-match verification.
- Implement deterministic scoring and alert generation.
- Add support states: `verified`, `needs_review`, `no_evidence`, `failed_source`.
- Tune prompts against 5 known pages until at least 4 of 5 produce one verified evidence item with quote-match score of at least 0.8.
- If the quality gate is not met by end of Day 3, reduce to the two best-performing signal templates.

### Day 4: UI Integration and Briefs

- Wire Command Center to `GET /api/companies`, `GET /api/alerts`, and agent status.
- Wire **Vendor Risk Agent** toggle to `PATCH /api/companies/{company_id}/agent`.
- Wire autonomous review-cycle polling to `GET /api/scans/{scan_id}`.
- Wire Evidence Drawer and Source Explorer to evidence and Bright Data trace endpoints.
- Wire Vendor Risk Assessment Brief generation to `POST /api/briefs/vendor-review`.
- Add side-by-side quote highlight view.
- Polish the related-change card for the curated vendor scenario.

### Day 5: Demo Hardening

- Run end-to-end tests on all demo vendors.
- Confirm automatic due-now behavior after enabling the agent.
- Confirm fallback behavior under Bright Data and LLM failures.
- Verify trace telemetry honestly labels live, cached, and fallback data.
- Record backup demo video.
- Remove unfinished surfaces and tighten the 3-minute script.

## 14. Hackathon Track Alignment

Primary alignment: **Security and Compliance / Third-Party Risk**.

Pulse directly addresses continuous vendor risk review. It monitors public trust, security, privacy, terms, pricing, status, and adverse-media sources, then produces evidence-backed review triggers for GRC and procurement workflows.

The project aligns especially well with the track examples:

- continuously monitoring the open web for compliance signals and risk indicators,
- delivering structured, actionable intelligence to responsible teams,
- using source coverage and bypass capability that internal tools cannot match,
- using an AI agent to investigate risk indicators and return structured risk assessments autonomously,
- continuously assessing supplier and vendor exposure across the web.

Bright Data is central rather than incidental:

- SERP API discovers current public sources.
- Markdown scraping turns live pages into extractable evidence.
- Web Unlocker demonstrates resilience for blocked public pages.
- Trace telemetry makes the sponsor integration visible to judges.

Secondary alignment: **Finance and Market Intelligence**, because procurement and finance teams benefit from renewal-relevant pricing and terms signals. GTM and competitor intelligence are deliberately excluded from the MVP demo to keep the product identity sharp.

## 15. Business Model

Pulse is a mid-market SaaS product priced by monitored vendor portfolio size and review cadence.

Initial paid wedge:

- $299/month for up to 15 vendors, weekly autonomous review cycles, evidence-backed alerts, and vendor risk assessment briefs.
- $599/month for up to 30 vendors, daily review cycles for critical vendors, team review workflow, and longer retention.

Enterprise expansion can add SSO, RBAC, audit retention, integrations, and custom source governance, but these are not MVP requirements.

The commercial gap is clear: Pulse sits between free alert tools that lack verification and enterprise risk intelligence platforms that can cost tens of thousands per year. Margins depend on strict source budgets, caching, content hashes, and review cadence controls.

## 16. Differentiation

Pulse differs from generic AI research tools and alert products in five ways:

- **Autonomous vendor-risk agent:** the user configures monitoring once, then the agent investigates due vendors and returns structured assessments.
- **Vendor-review wedge:** built for a concrete GRC workflow, not broad market intelligence.
- **Change-first:** focuses on what changed since the last review cycle, not static company summaries.
- **Evidence-first:** every high-priority alert has a source URL, captured timestamp, quote, support status, and confidence.
- **Bright Data-native:** source collection, unblocking, markdown conversion, and trace telemetry are visible product features.
- **Deterministic scoring:** the LLM extracts and summarizes; the risk score is computed and explainable.

The judge-visible differentiator is the autonomous agent status plus Source Explorer and highlighted quote verification view: the audience can see the agent activate, collect live public-web data, preserve source provenance, verify matched evidence, and produce a structured risk assessment.

## 17. Risks and Mitigations

| Risk | Why It Matters | Mitigation |
|---|---|---|
| Autonomous behavior feels fake | The track rewards agentic systems, so the demo must show real autonomous progression. | Use a real scheduler or `agents/tick` mechanism, due-now review policy, visible agent status, and automatic stage progression after enabling the agent. |
| Extraction quality is weak | The product value depends on accurate evidence extraction. | Limit MVP to three signal templates, use structured output, validate with Pydantic, tune against seeded pages, and drop to two templates if the quality gate fails. |
| Unsupported AI claims | False vendor-risk claims can damage trust. | Require quote matching for high-priority alerts and label weak evidence as `needs_review`. |
| Live Bright Data call fails | A stalled demo damages credibility. | Prewarm demo cycles, test one known-good live page, use an 8-second timeout, and fall back to labeled cached data. |
| Demo feels too mocked | Judges may doubt the system is real. | Show real Bright Data trace rows, live fetch status, captured timestamps, source URLs, source mode, raw quote support, and the agent activity timeline. |
| Public data is incomplete | Some vendor risk is hidden behind private portals. | Position Pulse as a public-web trigger layer that complements formal questionnaires. |
| Scope creep | Extra personas and pages can prevent completion. | Keep one persona, three UI surfaces, three signal templates, and one bounded autonomous agent workflow. |
| Scores seem arbitrary | Uncalibrated risk scores invite skepticism. | Show scoring constants, cap display score at 100, and expose top contributing evidence. |
| Noisy alerts | Users will stop trusting the feed. | Use source allow/block lists, content hashes, confidence thresholds, and dismissal feedback. |
| Company ambiguity | Wrong source matching creates false positives. | Require exact domain and use only preselected demo vendors in MVP. |
| Costs grow with review volume | Bright Data and LLM costs affect SaaS margins. | Use strict URL budgets, hash-based dedupe, cached LLM responses during development, and cadence limits. |
| Compliance and privacy concerns | Risk products must avoid overclaiming. | Collect only public company-level data and label outputs as review signals, not legal conclusions. |

## 18. Future Roadmap

### Near-Term V1

- Production-grade scheduled daily and weekly review cycles.
- PDF export after the Markdown/HTML brief is stable.
- Slack and email notifications.
- CSV import/export for vendor lists.
- Stronger source allow/block management.
- Review workflow with assignee, status, comments, and audit trail.
- Screenshot capture for selected evidence.
- PostgreSQL migration for hosted production.

### V2

- Jira, ServiceNow, Slack, Microsoft Teams, and procurement workflow integrations.
- SSO, RBAC, tenant isolation, and audit retention.
- Custom scoring weights by vendor tier and risk domain.
- Industry-specific vendor review templates.
- More source connectors through Bright Data structured scrapers.
- Human-labeled evaluation set for extraction quality.

### Long-Term

- Broader supplier and partner risk monitoring.
- Competitor and GTM intelligence as separate product views.
- Hiring and market expansion signals.
- Portfolio-level risk benchmarking.
- API access for procurement, security, and finance systems.

## 19. Final Pitch

Pulse is an autonomous vendor risk agent for lean GRC teams.

Instead of waiting for annual questionnaires or drowning in noisy alerts, a team configures its critical vendors once. Pulse then investigates due vendors across live public web sources using Bright Data, extracts source-backed risk evidence, verifies the quote, scores the change transparently, and generates a structured vendor risk assessment before renewal or audit.

It is not a chatbot. It is not alert spam. It is an auditable AI agent that turns live public web data into trusted third-party risk decisions.

## 20. Implementation Checklist

- [ ] Create Next.js frontend with Command Center, Evidence Drawer / Source Explorer, and Vendor Risk Assessment Brief surfaces.
- [ ] Create FastAPI backend with SQLite persistence.
- [ ] Define database tables: `companies`, `scans`, `evidence_items`, `alerts`, `brightdata_traces`.
- [ ] Add agent fields to `companies`: `agent_enabled`, `agent_status`, `review_policy`, `last_agent_run_at`, `next_agent_run_at`.
- [ ] Seed 5 demo vendors with exact domains, owners, criticality, renewal dates, source rules, and agent policy.
- [ ] Lock the demo vendor, live Bright Data URL, cached fallback payload, expected evidence items, and related-change card.
- [ ] Implement Vendor Risk Agent toggle.
- [ ] Implement lightweight scheduler or `POST /api/agents/tick` for due autonomous review cycles.
- [ ] Implement `GET /api/agents/status`.
- [ ] Implement Bright Data wrapper for SERP, markdown scraping, and Web Unlocker fallback.
- [ ] Log every Bright Data call with scan ID, product, operation, URL, status, latency, retry count, error, and source mode.
- [ ] Implement scan budgets: max 6 SERP queries, 12 scraped URLs, 8-second live timeout, and 20 LLM extraction calls per review cycle.
- [ ] Implement fallback-only `POST /api/scans/run`.
- [ ] Implement `GET /api/scans/{scan_id}` for polling.
- [ ] Implement `GET /api/companies` and `POST /api/companies`.
- [ ] Implement `PATCH /api/companies/{company_id}/agent`.
- [ ] Implement `GET /api/alerts` and `PATCH /api/alerts/{alert_id}`.
- [ ] Implement `GET /api/companies/{company_id}/evidence`.
- [ ] Implement `GET /api/brightdata/traces?scan_id=...`.
- [ ] Implement `POST /api/briefs/vendor-review`.
- [ ] Build the bounded autonomous agent workflow: due check, collect, extract/verify, score/assess.
- [ ] Add DeepSeek V4 Flash JSON extraction with DeepSeek V4 Pro escalation and GPT-5.4-mini fallback.
- [ ] Create three extraction prompts: trust/security, adverse media, pricing/terms.
- [ ] Validate LLM output with Pydantic before database insert.
- [ ] Retry malformed JSON once with a simpler prompt.
- [ ] Add RapidFuzz quote verification with default threshold 0.8.
- [ ] Store support states: `verified`, `needs_review`, `no_evidence`, `failed_source`.
- [ ] Implement deterministic scoring and cap display score at 100.
- [ ] Generate high-priority alerts only from verified evidence.
- [ ] Add rule-based related-change card for the curated demo vendor.
- [ ] Build side-by-side source quote view with highlighted matched quote.
- [ ] Build trace telemetry UI showing live, cached, and fallback status.
- [ ] Build Markdown or HTML vendor risk assessment brief export.
- [ ] Add replay mode from seeded JSON.
- [ ] Tune prompts until at least 4 of 5 seeded pages produce verified evidence with quote-match score of at least 0.8.
- [ ] If quality gate fails by end of Day 3, reduce to the two best-performing signal templates.
- [ ] Test live Bright Data call repeatedly before demo.
- [ ] Verify fallback behavior when Bright Data or LLM calls fail.
- [ ] Verify autonomous due-now demo flow after enabling the Vendor Risk Agent.
- [ ] Record backup demo video.
- [ ] Remove unfinished UI surfaces before final presentation.
- [ ] Rehearse the 3-minute demo script end to end.
