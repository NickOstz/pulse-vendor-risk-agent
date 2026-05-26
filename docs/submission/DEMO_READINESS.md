# Pulse Submission and Demo Readiness Packet

This packet is the judge-facing source of truth for the final hackathon
submission video, screenshots, and live walkthrough. It complements
`Demo Script.md` and `README.md`; if anything here conflicts with those files,
fix this packet before recording.

## Truth Boundary

| Claim area | What can be said | Visible proof to show | What not to imply |
| --- | --- | --- | --- |
| Autonomous workflow | A GRC user enables the Vendor Risk Agent, and the due-now Cloudflare review progresses through Collect, Extract, Verify, Score, and Brief. | Agent toggle, status panel, and five-stage review strip. | Do not make the primary story a manual scan button. Scheduler tick or recovery controls are backup only. |
| Bright Data proof | Pulse has one approved live Cloudflare Trust Hub capture path: `https://www.cloudflare.com/trust-hub/`. | Source Explorer trace rows with operation, URL, status, latency, timestamp, and source mode. | Do not claim every evidence item is live. Two official Cloudflare excerpts may be fallback evidence. |
| Replay and fallback | Replay is credential-free and labels traces as `cached`. Live-with-fallback labels live attempts and fallback rows honestly. | Source mode badges in Source Explorer, Evidence Drawer, status views, and the brief evidence table. | Do not hide fallback behind generic "completed" narration. Explain that fallback is an explicit reliability feature. |
| Evidence trust | High-priority alerts require verified quote support. Unsupported or weak evidence should be marked for review and excluded from high-priority scoring. | Alert detail, verified badge, quote support status, match score, and highlighted source quote. | Do not describe AI summaries as verified unless the quote is supported. |
| Scoring | The score is deterministic and explainable from severity, source reliability, confidence, freshness, and vendor criticality. | Score explanation in the Evidence Drawer or alert detail. | Do not say the LLM assigns the risk score. |
| Brief output | The Vendor Risk Assessment Brief is generated from verified evidence and can be exported as Markdown or HTML. | Brief surface, evidence table, Markdown export button, and HTML export button. | Do not claim legal, procurement, or security approval. The brief is a review artifact. |
| Model-backed extraction | Only claim live model-backed extraction if the final extraction PR has merged and rehearsal passes in the configured environment. | PR status plus successful rehearsal output. | If not merged or not configured, say the demo uses the current bounded review path with verified evidence and replay/fallback safety. |

## Three-Minute Video Shot List

| Time | Shot | Action | Narration goal | Proof captured |
| --- | --- | --- | --- | --- |
| 0:00-0:20 | Command Center opener | Start on the seeded SecurePay vendor watchlist. | Vendor risk changes between annual reviews. Pulse watches public sources and returns defensible evidence before renewal. | Vendor cards, renewal urgency, criticality, latest signals. |
| 0:20-0:45 | Cloudflare setup | Select Cloudflare. Point to owner, criticality, renewal date, and inactive agent state. | Cloudflare is a critical edge-security vendor renewing soon, so a lean GRC lead needs a fast assessment. | Selected vendor context and Vendor Risk Agent off/inactive. |
| 0:45-1:10 | Agent enablement | Toggle Vendor Risk Agent on. | The user enables monitoring once; the due-now policy starts the bounded review cycle. | Toggle state, monitoring mode, review policy, next review due now. |
| 1:10-1:30 | Stage progression | Show Collect, Extract, Verify, Score, and Brief progressing. | Pulse is autonomous but bounded: fixed sources, fixed budgets, verification, and scoring. | Review status strip and current activity. |
| 1:30-1:55 | Source Explorer | Open Source Explorer and show trace rows. | Bright Data collection is auditable, including live, cached, and fallback source modes. | Approved Trust Hub URL, trace status, latency, captured timestamp, source-mode badges. |
| 1:55-2:20 | Evidence proof | Open the high-priority alert and quote verification view. | AI extracts candidate evidence, but Pulse verifies quote support before high-priority scoring. | Verified support state, match score, highlighted quote, source URL. |
| 2:20-2:40 | Related change and score | Show the related-change card and score explanation. | Pulse groups compatible verified signals and explains why they matter before renewal. | Related-change card, deterministic score factors. |
| 2:40-2:55 | Assessment brief | Open the Vendor Risk Assessment Brief and skim the evidence table. | The output is a shareable GRC/procurement artifact, not a loose chatbot summary. | Summary, verified changes, evidence table, review status. |
| 2:55-3:00 | Export close | Click or point to Markdown and HTML export controls. | The team can share the current assessment immediately after the review. | Markdown and HTML export buttons visible and usable. |

Target total time: 2:55 with 5 seconds of cushion. If the stage animation is
slow, narrate over it once and move to the completed Source Explorer as soon as
the trace rows are visible.

## Product Claim to Visible Proof Checklist

Use this checklist in the final submission notes and before recording.

| Product claim | Required visible proof | Pass condition |
| --- | --- | --- |
| "Autonomous Vendor Risk Agent" | Agent enabled from the Command Center; due review starts without making a manual scan the primary action. | Status panel moves from active/running into the review cycle. |
| "Bright Data-powered public-web evidence" | Source Explorer trace row for `https://www.cloudflare.com/trust-hub/`. | Trace row is visible with Bright Data operation metadata and source mode. |
| "Truthful fallback/replay behavior" | Source mode labels in Source Explorer, Evidence Drawer, and brief evidence table. | `live`, `cached`, and `fallback` labels are not mixed or hidden. |
| "Verified quote support" | Side-by-side quote view. | Support status is `verified` and match score is visible for any high-priority alert. |
| "No unsupported high-priority alerts" | Alert detail plus evidence support state. | High-priority alert evidence is verified; weak evidence is not presented as high priority. |
| "Deterministic scoring" | Score explanation or factors. | Narration says code calculates the score; AI does not assign the score. |
| "Review-ready brief" | Vendor Risk Assessment Brief. | Brief includes summary, evidence table, risk interpretation, owner, next action, and review status. |
| "Exportable output" | Markdown and HTML controls. | Both controls are visible in the brief surface; do not record downloads over private folders or logs. |

## Rehearsal Commands

Run the credential-free rehearsal before every recording or judging session:

```powershell
cd backend
.\.venv\Scripts\python -m scripts.rehearse_demo
```

Run the controlled live-with-fallback proof only when local Bright Data
variables are configured in `backend/.env`:

```powershell
cd backend
.\.venv\Scripts\python -m scripts.rehearse_demo --mode live_with_fallback
```

Expected rehearsal proof:

- replay mode returns `completed` and `cached` source modes;
- live-with-fallback mode returns `completed_with_fallback` with `live` plus
  `fallback` source modes;
- all five stages are observed;
- high-priority alert evidence is verified;
- related-change card is present;
- Markdown and HTML brief formats are present;
- elapsed time is below 180 seconds.

## Screenshot and Recording Capture List

Capture these assets for the submission gallery or backup video. Prefer clean
browser chrome or cropped app-only shots.

| Asset | Required contents | Why it matters |
| --- | --- | --- |
| `01-command-center.png` | Watchlist, Cloudflare selected, renewal date, criticality, agent status. | Establishes the practical GRC workflow. |
| `02-agent-enabled.png` | Vendor Risk Agent on, autonomous monitoring mode, due-now policy. | Proves the user action that starts the agentic flow. |
| `03-review-stages.png` | Collect, Extract, Verify, Score, Brief status strip. | Makes the bounded autonomous workflow legible. |
| `04-source-explorer.png` | Trace rows with URL, operation, status, latency, timestamp, and source mode. | Shows Bright Data traceability and honest source labels. |
| `05-quote-verification.png` | Extracted quote, captured source excerpt, verified support, match score. | Shows evidence trust guardrails. |
| `06-related-change.png` | Related-change card tied to verified evidence. | Shows synthesis beyond one isolated alert. |
| `07-assessment-brief.png` | Brief summary and readable evidence table with modes and support states. | Shows the final business artifact. |
| `08-export-controls.png` | Markdown and HTML export controls in the brief. | Shows shareable output for the submission story. |

## Judge-Facing Narrative

Pulse is a bounded evidence agent for lean GRC teams. The demo follows one
story: SecurePay is reviewing Cloudflare before renewal, so the GRC lead turns
on the Vendor Risk Agent. Pulse starts a due-now review, collects public-web
evidence through the approved Cloudflare path and labeled fallback data,
verifies quote support, scores only verified evidence, and produces a
Vendor Risk Assessment Brief.

The important distinction for judges is that Pulse is not trying to be a broad
web-browsing chatbot. It is narrow by design: exact vendor domain, fixed source
categories, review budgets, visible Bright Data traces, quote verification,
deterministic scoring, and exportable assessment output. The submission should
therefore emphasize auditability and truthful source labeling as much as speed.

## Truthfulness Checklist Before Recording

- The selected vendor is Cloudflare in the SecurePay demo story.
- The approved live source is `https://www.cloudflare.com/trust-hub/`.
- The narration says "one live Cloudflare Trust Hub capture path" rather than
  "all evidence is live."
- Fallback rows are described as official Cloudflare fallback evidence, not as
  live collection.
- Replay mode is described as credential-free and cached.
- Live-with-fallback mode is described as optional and configured, requiring
  local Bright Data variables in `backend/.env`.
- No API keys, environment variables, backend logs, raw JSON payloads, or stack
  traces appear in the recording.
- High-priority alerts shown in the recording have verified quote support.
- The related-change card is tied to verified evidence.
- The brief evidence table includes source modes and support states.
- Markdown and HTML export controls are visible and usable.
- Model-backed extraction is claimed only after the final extraction PR is
  merged and the configured rehearsal passes.
- The close positions Pulse as a public-web review trigger and assessment
  assistant, not as legal advice or procurement approval.

## Recovery Narration

Use these lines only if the live demo needs recovery.

| Failure | Honest narration | Continue from |
| --- | --- | --- |
| Agent does not start immediately | "For demo reliability, I am triggering the same due-vendor scheduler check the agent runs automatically." | Review status strip. |
| Bright Data live capture fails or times out | "The live web attempt is recorded, then Pulse falls back to cached evidence and labels the source mode." | Source Explorer trace rows. |
| Polling is slow | "I am switching to the preloaded review result. It uses the same evidence, trace, verification, and brief surfaces." | Source Explorer or Evidence Drawer. |
| Brief is not ready | "The brief is rendered from verified evidence. I will show the pre-generated brief from this same review cycle." | Vendor Risk Assessment Brief. |
| Full app is unavailable | "I will use the backup recording of the same six-part flow: setup, agent enablement, stages, traces, verified quote, and brief." | Backup video. |

## Submission Risk Reduced

This packet reduces three submission risks:

1. Overclaiming live automation by forcing every public statement back to
   visible source modes, verified quotes, and deterministic scoring.
2. Losing time in the three-minute video by giving the presenter a timed shot
   list with proof moments and a five-second cushion.
3. Failing judging review because screenshots, export controls, fallback
   narration, and optional configured live proof are all captured intentionally.
