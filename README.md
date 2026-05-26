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

This repository contains the product blueprint and a running MVP: a Next.js
Command Center backed by FastAPI review cycles, Bright Data traces, one
verified live Cloudflare Trust Hub evidence path, labeled fallback evidence,
deterministic alert scoring, and a review brief.

Read first:

- [Proposal F Final.md](./Proposal%20F%20Final.md)
- [PRD.md](./PRD.md)
- [Technical Architecture.md](./Technical%20Architecture.md)
- [MVP Backlog.md](./MVP%20Backlog.md)
- [Demo Script.md](./Demo%20Script.md)
- [AGENTS.md](./AGENTS.md)

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

## Upstream Integrations

Three upstream reference resources are pinned as Git submodules:

- `vendor/brightdata-hack-pack`: examples and Bright Data hackathon references.
- `vendor/brightdata-skills`: Bright Data skill/reference material for agents.
- `vendor/claude-bright-data-research-agent`: mentor-provided Python reference
  for SERP, Web Unlocker, and visible activity events.

They are references, not application runtime dependencies. The active product
must keep collection and trace persistence inside the FastAPI backend. See
[docs/UPSTREAM_INTEGRATIONS.md](./docs/UPSTREAM_INTEGRATIONS.md).

Clone with integrations:

```bash
git clone --recurse-submodules https://github.com/NickOstz/pulse-vendor-risk-agent.git
cd pulse-vendor-risk-agent
git submodule update --init --recursive
```

## Team Workflow

The three-person branch ownership and PR process is in
[docs/TEAM_WORKFLOW.md](./docs/TEAM_WORKFLOW.md). The frozen MVP API boundary
is in [docs/API_CONTRACT.md](./docs/API_CONTRACT.md). Copy-paste Codex prompts
for the two teammate lanes are in
[docs/TEAMMATE_CODEX_PROMPTS.md](./docs/TEAMMATE_CODEX_PROMPTS.md).

## License

Pulse is licensed under the [MIT License](./LICENSE). The vendored submodules
retain their upstream history and their upstream license notices where
provided.
