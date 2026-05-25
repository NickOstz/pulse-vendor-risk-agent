# Copy-Paste Codex Prompts For Teammates

Each teammate should paste only their assigned prompt into their own Codex
session.

## Prompt For Teammate A: Frontend

```text
You are the frontend owner for our lablab.ai Web Data UNLOCKED hackathon project,
Pulse: Autonomous Vendor Risk Agent.

Repository: https://github.com/NickOstz/pulse-vendor-risk-agent
Your branch: feature/frontend-command-center

First, clone the repository with submodules if it is not already present:
git clone --recurse-submodules https://github.com/NickOstz/pulse-vendor-risk-agent.git
Then work only on your feature branch from updated main. Read README.md,
AGENTS.md, PRD.md, Technical Architecture.md, docs/API_CONTRACT.md, and
docs/TEAM_WORKFLOW.md before implementing.

Your ownership is frontend/ only, except for small frontend-specific docs or
test fixtures. Build the Next.js + React + TypeScript + Tailwind frontend for
the three MVP surfaces: Command Center, Evidence Drawer / Source Explorer, and
Vendor Risk Assessment Brief. Build against typed fixture data that exactly
matches docs/API_CONTRACT.md until backend endpoints land.

Implement in this order:
1. Scaffold frontend/ and shared API types/client.
2. Create a compact Command Center with seeded vendor cards sorted for the
   demo story, a selected critical vendor, and agent status.
3. Add the Vendor Risk Agent toggle and status panel.
4. Add the review strip for Collect, Extract, Verify, Score, Brief and polling
   abstraction for GET /api/scans/{id} every two seconds.
5. Add Evidence Drawer / Source Explorer showing source URL, quote, verified
   state, confidence, score explanation, Bright Data trace rows, and
   live/cached/fallback badges.
6. Add side-by-side quote verification highlighting and a readable brief view.

Important constraints:
- Never call Bright Data or use API keys in the frontend.
- Do not invent endpoints or edit docs/API_CONTRACT.md without flagging a
  contract proposal in your PR.
- Make replay and fallback states visibly honest.
- Do not edit vendor/ submodules.
- Keep the demo to the three approved surfaces, no extra dashboard scope.

Run frontend lint/typecheck/build or focused tests before pushing. Commit only
your lane changes, push your feature branch, and open a PR describing what is
real, what uses fixture data, checks run, and any backend contract needs.
```

## Prompt For Teammate B: Backend Foundation

```text
You are the backend foundation owner for our lablab.ai Web Data UNLOCKED
hackathon project, Pulse: Autonomous Vendor Risk Agent.

Repository: https://github.com/NickOstz/pulse-vendor-risk-agent
Your branch: feature/backend-foundation

First, clone the repository with submodules if it is not already present:
git clone --recurse-submodules https://github.com/NickOstz/pulse-vendor-risk-agent.git
Then work only on your feature branch from updated main. Read README.md,
AGENTS.md, PRD.md, Technical Architecture.md, docs/API_CONTRACT.md,
docs/TEAM_WORKFLOW.md, and docs/UPSTREAM_INTEGRATIONS.md before implementing.

Your ownership is the FastAPI foundation: backend/app/main.py, configuration,
SQLite database/models/schemas, deterministic seed/replay data, API routers,
scheduler/tick/status behavior, and backend tests. The integration lead owns
live Bright Data, extraction, quote verification, scoring, related-change,
and brief-rendering service implementations; define clean call boundaries or
temporary replay adapters for those instead of implementing over them.
The mentor template under `vendor/claude-bright-data-research-agent` is
read-only reference material for response/trace shapes only; do not port its
Flask or Claude runtime into Pulse.

Implement in this order:
1. Scaffold backend/ with FastAPI, SQLModel or SQLAlchemy plus Pydantic, test
   setup, .env.example variable names only, and GET /api/health.
2. Define companies, scans, evidence_items, alerts, and brightdata_traces
   tables matching Technical Architecture.md and docs/API_CONTRACT.md.
3. Seed five demo vendors and a replay review for the curated critical vendor,
   including honest cached trace rows and verified-evidence-shaped fixtures.
4. Implement company list/create and PATCH agent enable/disable. The demo
   vendor must become due now when enabled.
5. Implement GET /api/agents/status, POST /api/agents/tick, creation of scans,
   and GET /api/scans/{id} with Collect/Extract/Verify/Score/Brief stages.
6. Expose replay-backed alert, evidence, trace, and brief endpoints so the
   frontend has the full demo contract while live services are developed.

Important constraints:
- No credentials in Git; each teammate uses a local .env.
- Collection is public-web only.
- Do not edit frontend/ or vendor/ submodules.
- Do not change docs/API_CONTRACT.md silently; propose contract changes in
  the PR.
- Stub external pipelines via explicit interfaces or replay loaders, never
  pretend seeded evidence is live.

Run backend tests before pushing. Commit only your lane changes, push the
branch, and open a PR describing endpoint coverage, fixture/replay behavior,
checks run, and service hooks required from the integration lead.
```
