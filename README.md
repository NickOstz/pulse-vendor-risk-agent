# Pulse: Autonomous Vendor Risk Agent

Pulse is a bounded AI agent for continuous third-party vendor risk review. It
uses Bright Data to collect live public-web evidence, verifies source-backed
claims, scores verified signals deterministically, and produces a vendor risk
assessment brief before renewal or audit.

## Hackathon

Pulse is being built for the [Web Data UNLOCKED Hackathon](https://lablab.ai/ai-hackathons/brightdata-ai-agents-web-data-hackathon).
The online build window is May 25-30, 2026. The submission requires a public
GitHub repository and demonstrable use of at least one Bright Data product.

Primary track: **Security & Compliance / Third-Party Risk**.

## Current State

This repository contains a running MVP: a Next.js Command Center backed by
FastAPI autonomous review cycles, Bright Data SERP-led multi-source
investigation, DeepSeek structured assessment over quote-verified findings,
deterministic alert scoring, labeled fallback evidence, and a review brief.

## MVP Architecture

```text
Next.js / React / TypeScript / Tailwind frontend
                 |
                 v
Python FastAPI backend and SQLite
  |-- scheduler and bounded review runner
  |-- Bright Data collection wrapper and visible traces
  |-- Pydantic extraction validation
  |-- RapidFuzz quote verification
  |-- deterministic risk scoring and brief rendering
                 |
                 v
Bright Data SERP + markdown/web collection + labeled fallback/replay
```

Non-negotiables:

- Bright Data and LLM credentials remain server-side and are never committed.
- Only public sources are collected; login-only and unauthorized sources are out of scope.
- A high-priority alert requires a verified supporting quote.
- The score is calculated by code, not invented by the LLM.
- Replay and fallback data are visibly labeled as `cached` or `fallback`.

## Demo Rehearsal

Run a disposable, credential-free full-flow check before a demo:

```powershell
cd backend
.\.venv\Scripts\python -m scripts.rehearse_demo
```

For a controlled proof run using locally configured Bright Data credentials,
the bounded discovery request, and the approved Cloudflare Trust Hub capture
attempt:

```powershell
cd backend
.\.venv\Scripts\python -m scripts.rehearse_demo --mode live_with_fallback
```

Both modes create a temporary SQLite database and temporary live-snapshot
directory, exercise agent enablement through brief generation, validate
verified-evidence alert invariants, and fail if the flow exceeds three
minutes. The commands never print credentials or persist collected live
snapshots in the repository.

Structured model extraction is opt-in for the controlled live proof. Set
`LLM_EXTRACTION_ENABLED=true` with `DEEPSEEK_API_KEY` configured to extract
the approved live Trust Hub source using DeepSeek JSON output. Pulse validates
the result with Pydantic, retries malformed output once, and enforces the
20-call review budget; the default rehearsal remains deterministic.

Run the five-page structured extraction baseline from bounded official
Cloudflare excerpts:

```powershell
cd backend
.\.venv\Scripts\python -m scripts.evaluate_extraction
```

This recorded baseline checks fixture/schema/quote-verification integrity. To
measure the configured model against the same quality gate, set
`DEEPSEEK_API_KEY` locally and run:

```powershell
cd backend
.\.venv\Scripts\python -m scripts.evaluate_extraction --mode deepseek
```

The quality gate requires at least four of five pages to yield verified
evidence with a quote-match score of at least `0.8`; a failed run reports the
two best-performing signal templates.

## License

Pulse is licensed under the [MIT License](./LICENSE).
