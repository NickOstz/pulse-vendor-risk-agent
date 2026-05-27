# Pulse: Autonomous Vendor Risk Agent

Pulse is a hackathon MVP for continuous third-party vendor risk review. A GRC
operator enables a Vendor Risk Agent, Pulse collects public web evidence through
Bright Data, verifies that extracted claims are supported by source quotes,
scores only verified signals, and produces a review-ready vendor risk assessment
brief.

Built for the [Web Data UNLOCKED Hackathon](https://lablab.ai/ai-hackathons/brightdata-ai-agents-web-data-hackathon)
Track 3: Security & Compliance / Third-Party Risk.

## Demo Story

SecurePay is preparing a renewal review for Cloudflare, a critical edge-security
vendor. Instead of waiting for an annual questionnaire, the risk lead turns on
the Vendor Risk Agent. Pulse starts a bounded autonomous review, shows Bright
Data collection traces, verifies public-source quotes, and drafts a brief for
Security and Procurement.

The demo is designed to show five things:

- autonomous review start after agent enablement;
- Bright Data SERP discovery and public page collection owned by the backend;
- quote verification before a finding can score;
- deterministic risk scoring with source-mode labels;
- a vendor risk assessment brief built from verified evidence only.

## What Works

- Next.js Command Center with seeded vendor watchlist.
- Vendor Risk Agent toggle, watchlist enablement, status panel, and scan polling.
- FastAPI scheduler/tick path that starts due autonomous review cycles.
- SQLite persistence for companies, scans, evidence, alerts, traces, and briefs.
- Bright Data SERP-led discovery plus Web Unlocker page capture for controlled
  live review paths.
- Replay and fallback paths that are visibly labeled as `cached` or `fallback`.
- DeepSeek structured extraction for live evidence and optional assessment wording.
- Pydantic validation, RapidFuzz quote matching, deterministic scoring, and
  high-priority alert gating.
- Evidence Drawer / Source Explorer with quote support, score factors, trace
  telemetry, and source-mode labels.
- Markdown and HTML Vendor Risk Assessment Brief export.
- Hosted-write protection through `DEMO_API_TOKEN` and
  `X-Pulse-Operator-Token`.

## Architecture

```text
Next.js / React / TypeScript / Tailwind
  Command Center
  Evidence Drawer / Source Explorer
  Vendor Risk Assessment Brief
                 |
                 v
Python FastAPI backend + SQLite
  scheduler and bounded review runner
  Bright Data collection wrapper and trace storage
  DeepSeek structured extraction
  Pydantic validation and RapidFuzz quote verification
  deterministic scoring and brief rendering
                 |
                 v
Bright Data SERP + Web Unlocker
  live collection, cached replay, labeled fallback
```

The frontend never calls Bright Data or exposes provider credentials. All live
collection, extraction, verification, scoring, fallback handling, and trace
storage happen server-side.

## Evidence Rules

Pulse is intentionally narrow and defensive:

- collect only public company-level sources;
- require exact vendor domains for vendor-owned sources;
- record Bright Data product, operation, URL, timestamp, latency, status, and
  source mode for each collection operation;
- mark evidence `verified` only after exact or fuzzy quote matching at the
  configured `0.8` threshold;
- exclude unsupported evidence from high-priority alert scoring;
- calculate scores in code and cap display scores at 100;
- label replay and fallback evidence honestly.

## Bright Data Usage

Pulse uses Bright Data from the FastAPI backend:

- SERP API for bounded vendor-risk discovery queries across trust/security,
  pricing/terms, and adverse-media templates.
- Web Unlocker for public page capture on approved discovered or configured
  sources.
- Trace rows persisted to SQLite and displayed in the Source Explorer.
- Cached replay/fallback payloads so the demo survives provider failure without
  hiding the source mode.

The controlled Cloudflare live proof can include:

```text
BRIGHTDATA_DEMO_SOURCE_URL=https://www.cloudflare.com/trust-hub/
```

## DeepSeek Role

DeepSeek is used only for structured extraction and optional assessment wording.
It does not assign risk scores and it cannot make unsupported claims actionable.
Pulse validates every extraction result with Pydantic, retries malformed JSON
once, then verifies the supporting quote against captured source text before the
finding can become a scored alert.

## Local Setup

Backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8011
```

Frontend:

```powershell
cd frontend
npm install
$env:NEXT_PUBLIC_API_BASE_URL = "http://localhost:8011"
npm run dev
```

Open the frontend at `http://localhost:3000` or the next available Next.js port.
Check backend readiness at `http://localhost:8011/api/health`.

If `NEXT_PUBLIC_API_BASE_URL` is unset, the frontend runs against built-in
fixture data for UI review.

## Environment Variables

Backend variables are server-side only:

```text
DATABASE_URL=sqlite:///./pulse.db
BRIGHTDATA_API_KEY=
BRIGHTDATA_SERP_ZONE=
BRIGHTDATA_UNLOCKER_ZONE=
BRIGHTDATA_DEMO_SOURCE_URL=https://www.cloudflare.com/trust-hub/
BRIGHTDATA_LIVE_FETCH_TIMEOUT_SECONDS=8
BRIGHTDATA_SERP_TIMEOUT_SECONDS=20
FALLBACK_EVIDENCE_ENABLED=false
DEEPSEEK_API_KEY=
LLM_EXTRACTION_ENABLED=true
DEFAULT_REVIEW_MODE=live_with_fallback
AUTONOMOUS_SCHEDULER_ENABLED=false
AUTONOMOUS_SCHEDULER_INTERVAL_SECONDS=10
DEMO_API_TOKEN=
```

Frontend variable:

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:8011
```

Do not put Bright Data, DeepSeek, or operator tokens in frontend
`NEXT_PUBLIC_*` variables.

## Demo Rehearsal

Run the credential-free full-flow rehearsal:

```powershell
cd backend
.\.venv\Scripts\python -m scripts.rehearse_demo
```

Run the controlled live rehearsal when local Bright Data and DeepSeek
credentials are configured:

```powershell
cd backend
.\.venv\Scripts\python -m scripts.rehearse_demo --mode live_with_fallback
```

By default `FALLBACK_EVIDENCE_ENABLED=false`, so a configured live run records
provider failures as trace rows instead of injecting fallback evidence. Set that
flag to `true` only when you intentionally want the older fallback demo path.

Run the structured extraction quality baseline:

```powershell
cd backend
.\.venv\Scripts\python -m scripts.evaluate_extraction
```

To evaluate the configured model against the same fixtures:

```powershell
cd backend
.\.venv\Scripts\python -m scripts.evaluate_extraction --mode deepseek
```

The quality gate requires at least four of five pages to produce verified
evidence with quote-match score of at least `0.8`.

## Deployment Notes

Backend hosting should run one replica for the MVP because scan-stage
progression and due-review creation are serialized with in-process locks.
Before a public hosted demo, configure `DEMO_API_TOKEN`; `/api/health` should
report:

```json
{
  "write_protection_enabled": true
}
```

When write protection is enabled, public read-only evidence and completed
brief views remain accessible, while mutation and provider-spend endpoints
require `X-Pulse-Operator-Token`.

## Repository Safety

Credentials, local SQLite databases, live captures, and local planning material
are excluded from the public submission tree. The tracked repository keeps only
the application code, public README, and deterministic cached-source fixtures
needed by the replay/fallback path.

## License

Pulse is licensed under the [MIT License](./LICENSE).
