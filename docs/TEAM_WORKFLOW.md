# Three-Person Team Workflow

## Recommended Ownership

The cleanest split gives each person a directory or service surface with
minimal merge conflict.

| Person | Primary lane | Owns first | Avoids changing without coordination |
| --- | --- | --- | --- |
| You: integration lead | Bright Data, evidence quality, final demo | `backend/app/services/brightdata_client.py`, `extraction.py`, `verification.py`, `scoring.py`, `related_changes.py`, `brief_renderer.py`, integration tests and demo decisions | Backend schemas/routes once teammate is active; frontend components |
| Teammate A | Frontend product flow | `frontend/` app shell, Command Center, toggle/status polling, Evidence Drawer, Source Explorer, Quote View, Brief view | Backend implementation and API contract |
| Teammate B | Backend foundation | `backend/app/main.py`, config/database/models/schemas, seeds/replay, API routes, scheduler/tick/status, backend tests | Integration-lead service implementations; frontend |

Teammate B should expose service interfaces or temporary replay results early;
you fill the live collection/extraction pipeline behind them. Teammate A can
work immediately against typed fixture responses matching
`docs/API_CONTRACT.md`.

## GitHub Setup

The hackathon requires a public GitHub repository. Before publishing, quickly
check that no private notes or tokens are present. From this prepared local
repository, the repository owner can publish it once with:

```bash
gh repo create pulse-vendor-risk-agent --public --source=. --remote=origin --push
```

Then invite both collaborators in GitHub repository settings and enable:

- Require a pull request before merging to `main`.
- Require one approval when practical; during the final demo crunch, record
  review in the PR before merging.
- Do not allow force pushes to `main`.
- Enable issues or a project board with labels `frontend`, `backend`,
  `integration`, `demo`, and `blocked`.

## Clone And Branch Routine

Each teammate starts with:

```bash
git clone --recurse-submodules <PUBLIC_GITHUB_REPOSITORY_URL>
cd pulse-vendor-risk-agent
git submodule update --init --recursive
git switch -c feature/<short-lane-name>
```

Before new work:

```bash
git switch main
git pull --ff-only origin main
git submodule update --init --recursive
git switch -c feature/<next-task>
```

Submit work:

```bash
git status
git add <files-owned-by-your-lane>
git commit -m "feat: <small completed outcome>"
git push -u origin feature/<short-lane-name>
gh pr create --fill
```

## Pull Request Rules

- One PR should implement one reviewable outcome, such as schema plus seeds,
  Command Center shell, or quote-verification service.
- Mention any API contract assumption and add a fixture/test for it.
- Do not commit `.env`, API keys, production source captures, or local SQLite
  databases.
- Treat `vendor/` as pinned reference content; do not casually update its
  submodule commits in a feature PR.
- Merge in dependency order and have affected teammates rebase or merge
  updated `main` promptly.

## Merge Order And Handoffs

| Order | Deliverable | Owner | Unblocks |
| --- | --- | --- | --- |
| 1 | Backend schemas, SQLite seeds, replay fixture, health/company API | Backend | Frontend integration and service tests |
| 2 | Frontend app shell and typed fixture UI | Frontend | Visible demo flow |
| 3 | Scheduler/tick plus scan status endpoints | Backend | Toggle-to-status demo |
| 4 | Bright Data wrapper and trace persistence | Integration lead | Sponsor proof |
| 5 | Extract, verify, score, related card, brief services | Integration lead | Complete assessment |
| 6 | Real API wiring in Evidence Drawer and brief | Frontend | End-to-end demo |
| 7 | Live/fallback/replay hardening and recording | Everyone | Submission |

## Remaining Build Window

| Date | Team target |
| --- | --- |
| May 26, 2026 | Publish repo, freeze contract, scaffold frontend/backend, seed replay payload |
| May 27, 2026 | Toggle-to-replay end-to-end flow and status polling visible |
| May 28, 2026 | Bright Data live wrapper, traces, extraction, verification, scoring |
| May 29, 2026 | Evidence/brief polish, fallback tests, deployed or stable local demo, record video |
| May 30, 2026 | Submission assets, final public repository cleanup, rehearsal and submit |

## Daily Sync

Use a short shared note or chat update twice daily:

```text
Done:
Branch/PR:
Contract changes needed:
Blocker:
Next demo-visible result:
```

The north-star check is simple: by the end of each day, can the demo show one
more honest step from agent toggle to verified assessment brief?
