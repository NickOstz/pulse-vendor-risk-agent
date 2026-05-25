# Pulse Agent Instructions

These instructions apply to every Codex session working in this repository.

## Mission

Build the smallest convincing Pulse MVP for the Web Data UNLOCKED Hackathon:
a GRC user enables an autonomous vendor risk agent, the agent collects public
web evidence through Bright Data, verifies quotes, scores only verified
signals, and returns a review-ready vendor risk assessment brief.

## Read Before Editing

1. Read `PRD.md`, `Technical Architecture.md`, and the part of
   `MVP Backlog.md` relevant to your assigned lane.
2. Read `docs/API_CONTRACT.md` and `docs/TEAM_WORKFLOW.md`.
3. For Bright Data implementation work, read
   `docs/UPSTREAM_INTEGRATIONS.md` and the relevant reference files under
   `vendor/`.

## Engineering Discipline

These project rules adapt the useful parts of the
[Karpathy-inspired coding guidelines](https://github.com/multica-ai/andrej-karpathy-skills/blob/main/CLAUDE.md)
to Pulse's hackathon constraints:

- Surface material assumptions before changing contracts, choosing live
  sources, or changing the demo path. Ask only when the answer cannot be
  safely discovered from the repository or agreed architecture.
- Prefer the smallest implementation that proves the current demo outcome.
  Do not add speculative product pages, agent frameworks, provider
  abstractions, or configuration systems.
- Keep changes surgical: edit the files required for your lane, preserve
  established style, and remove only unused code introduced by your change.
- Define verification before implementation on non-trivial work. A useful
  task ends with a visible behavior or focused check, such as an endpoint
  test, a quote-match test, a frontend typecheck, or an end-to-end replay
  pass.

## Architecture Boundaries

- `frontend/` is Next.js, React, TypeScript, and Tailwind. It talks to the
  FastAPI API; it must not call Bright Data directly or expose credentials.
- `backend/` is FastAPI, SQLite, Pydantic, and RapidFuzz. It owns scheduler
  behavior, Bright Data calls, trace storage, evidence verification, scoring,
  replay/fallback behavior, and brief generation.
- `vendor/brightdata-hack-pack`, `vendor/brightdata-skills`, and
  `vendor/claude-bright-data-research-agent` are pinned upstream submodules.
  Treat them as read-only reference material. Never implement Pulse by editing
  a submodule.
- Keep the active product to three surfaces: Command Center, Evidence Drawer /
  Source Explorer, and Vendor Risk Assessment Brief.

## Mentor Template Boundary

The mentor research-agent template is useful for Bright Data request examples
and progress-event ideas. It is not the Pulse runtime foundation:

- Reuse the server-side SERP and Web Unlocker request concepts through the
  FastAPI Bright Data wrapper, with Pulse trace records and budgets.
- Reuse the idea of visible collection progress through Pulse's scan status
  and Source Explorer UI.
- Do not port its Flask app, broad startup-report prompt, unconstrained source
  selection, or Anthropic-specific tool-use loop into the MVP.

## Product Invariants

- Collect only public company-level sources.
- Require exact vendor domains; do not invent company resolution.
- Record Bright Data operation, source URL, timestamp, latency, status, and
  `live`, `cached`, or `fallback` source mode.
- Mark evidence `verified` only after exact or RapidFuzz quote matching at the
  configured `0.8` threshold.
- Never create a high-priority alert from unsupported evidence.
- Calculate the display score deterministically and cap it at 100.
- The demo must survive external failure through honestly labeled replay or
  fallback data.

## Team Boundaries

- Integration lead owns shared contracts, Bright Data/evidence services, demo
  integration, CI/deployment decisions, and final merge ordering.
- Backend lane owns database models, seed/replay persistence, API routes,
  scheduler/tick behavior, and API tests.
- Frontend lane owns UI components, API client/types, status polling, evidence
  presentation, and UI tests.
- Changes to `docs/API_CONTRACT.md`, shared schemas, or integration-owned
  service interfaces require a short coordination note in the pull request.

## Working Rules

- Start work from an updated `main` on a dedicated branch.
- Keep credentials in local `.env` files only; commit example variable names,
  never keys, tokens, zones containing secrets, or collected sensitive output.
- Prefer seeded deterministic fixtures for UI and API development.
- Run focused tests or lint/type checks for every touched lane and report what
  was run in the PR.
- Open small pull requests; avoid editing files owned by another active lane
  unless the contract change is agreed first.
