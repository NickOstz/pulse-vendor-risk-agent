# Pulse Judge Runbook

Use this runbook when a judge, teammate, or demo operator needs to verify Pulse
without editing backend integration services or the active frontend flow.

## What This Proves

- The credential-free replay path can complete the autonomous review cycle.
- The optional live-with-fallback path attempts the approved Cloudflare Trust
  Hub source when Bright Data credentials are configured locally.
- The frontend can point at the local FastAPI backend through a public
  `NEXT_PUBLIC_*` variable only.
- Health and build checks can be run without committing secrets, local
  databases, or live captures.

## Prerequisites

- Python 3.11 or newer.
- Node.js 20 or newer.
- npm.
- Optional: Bright Data credentials for live-with-fallback proof.

## Secret-Safe Setup

Backend variables stay in `backend/.env` and must not be committed:

```powershell
cd backend
Copy-Item .env.example .env
```

For credential-free replay, leave the Bright Data and LLM keys blank. For the
controlled live proof, fill only local values in `backend/.env` and keep the
approved demo source:

```text
BRIGHTDATA_DEMO_SOURCE_URL=https://www.cloudflare.com/trust-hub/
DEFAULT_REVIEW_MODE=live_with_fallback
```

Frontend variables are public by design. Copy the example when running against
a local backend:

```powershell
cd frontend
Copy-Item .env.example .env.local
```

## Install Dependencies

Backend:

```powershell
cd backend
py -3 -m venv .venv
.\.venv\Scripts\python -m pip install -e ".[dev]"
```

Frontend:

```powershell
cd frontend
npm ci
```

## Rehearsal Proof

Credential-free replay should work without Bright Data credentials:

```powershell
cd backend
.\.venv\Scripts\python -m scripts.rehearse_demo
```

Expected result:

- `status` is `completed`;
- elapsed time is below `180` seconds;
- all five stages appear;
- source modes are `cached`;
- high-priority alerts are backed only by verified evidence;
- Markdown and HTML brief formats are checked.

Run the controlled live proof only when local Bright Data variables are
configured:

```powershell
cd backend
.\.venv\Scripts\python -m scripts.rehearse_demo --mode live_with_fallback
```

Expected result:

- `status` is `completed_with_fallback`;
- source modes include `live` and `fallback`;
- the live trace includes `https://www.cloudflare.com/trust-hub/`;
- live snapshots are written only to the temporary rehearsal directory.

## Local App Run

Terminal 1, backend:

```powershell
cd backend
.\.venv\Scripts\python -m uvicorn app.main:create_app --factory --reload --host 127.0.0.1 --port 8000
```

Terminal 2, frontend:

```powershell
cd frontend
npm run dev
```

Open:

```text
http://localhost:3000
```

Backend health:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

Replay readiness is enough for judging the deterministic demo path. Bright Data
key presence is required only for the optional live-with-fallback proof.

## Hosted App Check

When a hosted build has been provisioned, use the
[Deployment Checklist](./DEPLOYMENT.md) to configure the Railway backend,
Vercel frontend, persistent SQLite volume, and hosted-origin CORS boundary.
Do not describe hosting as complete until the deployed backend health endpoint
returns `status: ok` and the hosted Command Center loads it successfully.

## Submission Checklist

- `backend/.env` exists locally and is not staged.
- `frontend/.env.local` exists locally only if needed and is not staged.
- `backend/pulse.db`, `*.sqlite`, and `*.sqlite3` are not staged.
- `backend/app/snapshots/live/` and `backend/app/snapshots/captured/` are not
  staged.
- `cd backend; .\.venv\Scripts\python -m pytest -q` passes.
- `cd backend; .\.venv\Scripts\python -m scripts.rehearse_demo` completes.
- Optional live proof completes only on a machine with local Bright Data
  credentials.
- `cd frontend; npm run typecheck` passes.
- `cd frontend; npm run build` passes.
