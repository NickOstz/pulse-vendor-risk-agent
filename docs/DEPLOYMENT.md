# Pulse Deployment Checklist

This checklist prepares the optional hosted demo path. It does not by itself
prove that Pulse has been deployed. Record deployed URLs and health-check
results only after the platform projects are connected and verified.

## Target Layout

| Surface | Host | Repository root directory | Purpose |
| --- | --- | --- | --- |
| Frontend | Vercel | `frontend` | Next.js Command Center |
| Backend | Railway | `backend` | FastAPI API, replay seeds, SQLite state |

This follows the MVP architecture and the platform monorepo guidance:

- [Vercel monorepo projects](https://vercel.com/docs/monorepos/) support
  configuring a project for the frontend directory.
- [Railway monorepo services](https://docs.railway.com/guides/monorepo)
  support a backend root directory and a config file location.
- [Railway healthchecks](https://docs.railway.com/reference/healthchecks)
  activate a deployment only after its configured endpoint returns HTTP 200.
- [Railway volumes](https://docs.railway.com/volumes) provide persistent
  storage for the SQLite file between deployments.

## Backend On Railway

1. Import the repository as a Railway service.
2. Set the service root directory to `/backend`.
3. Set the Railway config file path to `/backend/railway.json`.
4. Generate a public backend domain.
5. Attach one persistent volume mounted at `/data`.
6. Configure these server-side variables:

```text
DATABASE_URL=sqlite:////data/pulse.db
CORS_ALLOWED_ORIGINS=https://<your-vercel-production-domain>
DEFAULT_REVIEW_MODE=replay
BRIGHTDATA_API_KEY=
BRIGHTDATA_SERP_ZONE=
BRIGHTDATA_UNLOCKER_ZONE=
BRIGHTDATA_DEMO_SOURCE_URL=
DEEPSEEK_API_KEY=
LLM_EXTRACTION_ENABLED=false
AUTONOMOUS_SCHEDULER_ENABLED=false
AUTONOMOUS_SCHEDULER_INTERVAL_SECONDS=10
DEMO_API_TOKEN=<generate-a-private-operator-token>
```

Keep replay mode enabled for the credential-free hosted proof. Add Bright Data
and extraction variables only for a controlled live-with-fallback proof; never
put secrets in Vercel public variables or committed files.

Set `AUTONOMOUS_SCHEDULER_ENABLED=true` only when the monitored environment is
ready to perform recurring reviews. With live Bright Data and DeepSeek keys,
scheduled reviews can consume provider usage without an open browser.

Set `DEMO_API_TOKEN` when the Railway backend is publicly reachable. With this
value configured, write controls and manual review triggers require the
operator token, while completed evidence and brief views remain readable.
Enter the token in the frontend's **Controls locked** menu during your own
session. It is retained only in that browser tab. Do not add it as a Vercel
`NEXT_PUBLIC_*` variable.

`backend/railway.json` starts Uvicorn on Railway's assigned port and uses
`/api/health` for deployment health. The replay JSON files remain in the
backend build, and application startup creates and seeds an empty SQLite
database on the mounted volume.

## Frontend On Vercel

1. Import the same repository as a separate Vercel project.
2. Set the root directory to `frontend`.
3. Configure the public build-time variable using the deployed backend URL:

```text
NEXT_PUBLIC_API_BASE_URL=https://<your-railway-backend-domain>
```

4. Deploy the frontend after the backend URL is available.
5. Add the final Vercel production origin to Railway
   `CORS_ALLOWED_ORIGINS`, then redeploy the backend if that value changed.

Preview domains must be added explicitly as comma-separated origins when they
need API access. Avoid wildcard origins because the API supports credentials.

## Hosted Verification

Backend health:

```powershell
$health = Invoke-RestMethod https://<your-railway-backend-domain>/api/health
$health
```

Required replay-ready result:

```text
status              : ok
database            : True
scheduler           : True
replay_data         : True
```

Browser validation:

1. Open `https://<your-vercel-production-domain>`.
2. Confirm the header readiness indicator reports the backend, database,
   scheduler, and replay evidence as ready.
3. Enable the Cloudflare vendor risk agent and confirm the cycle completes.
4. Confirm cached or fallback modes remain visible in evidence and trace rows.
5. Confirm a generated brief can be opened after the completed review.

Capture the final frontend URL, backend health URL, health result, and
successful review-cycle timestamp in the submission packet only after these
checks pass.

## Rollback Path

If hosted configuration is incomplete during the submission window, use the
local runbook and recorded replay path. The hosted deployment is optional; it
must not replace a reliable and truthfully labeled local demo.
