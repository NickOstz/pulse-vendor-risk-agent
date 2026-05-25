# 3-Minute Demo Script

## 0:00-0:20 — Problem Hook

**Narration:**

"Vendor reviews usually happen once a year. But vendor risk changes any week. A vendor updates its security page, a pricing page changes before renewal, or a breach mention appears online."

"Pulse is an autonomous vendor risk agent. It watches public web sources, verifies the evidence, and gives GRC teams a review-ready risk assessment before renewal or audit."

**Screen:**

- Start on the Command Center.
- Show vendor cards with renewal dates, criticality, agent status, and latest risk signals.

**Judge takeaway:**

Pulse helps teams catch vendor-risk changes before they become renewal, audit, or compliance problems.

## 0:20-0:45 — User Setup

**Narration:**

"Our user is a GRC lead at SecurePay, a mid-market fintech. They have a critical database vendor renewing in 45 days. Before procurement signs, they need to know if anything public changed since the last review."

"They do not have an analyst team. They need a fast, defensible assessment with sources."

**Actions:**

1. Highlight SecurePay's vendor watchlist.
2. Open the critical database vendor.
3. Point to owner, criticality, renewal date, and agent status.

**Screen:**

- Command Center.
- Selected vendor profile or detail panel.
- Vendor Risk Agent shown as Off or inactive.

**Judge takeaway:**

This is a practical business workflow for security, compliance, and procurement teams.

## 0:45-1:30 — Product Walkthrough

**Narration:**

"The user does not run a one-off search. They enable the Vendor Risk Agent."

"Because this vendor is critical and the renewal is within 60 days, Pulse marks the next review as due now. From here, the agent starts the review cycle automatically."

**Actions:**

1. Toggle **Vendor Risk Agent** from Off to On.
2. Show the Agent Status Panel:
   - monitoring mode: autonomous,
   - review policy: critical vendor, renewal within 60 days,
   - next review: due now,
   - current activity: investigating public sources.
3. Show the review status strip progressing through:
   - Collect,
   - Extract,
   - Verify,
   - Score,
   - Brief.

**Narration while status progresses:**

"The agent works inside strict limits. It checks targeted public sources, uses Bright Data for live web access, and keeps a visible trail of what it collected."

**Screen:**

- Agent toggle.
- Agent Status Panel.
- Review status strip.

**Judge takeaway:**

The user configures monitoring once; the agent handles the investigation and assessment workflow.

## 1:30-2:15 — AI/Agent Wow Moment

**Narration:**

"Here is the agent's evidence trail. Pulse is not just writing a summary. It shows where the information came from."

**Actions:**

1. Open Source Explorer.
2. Show Bright Data trace rows:
   - source URL,
   - operation,
   - status,
   - latency,
   - captured timestamp,
   - source mode: live, cached, or fallback.
3. Open a high-priority alert.
4. Show the side-by-side quote verification view.
5. Point to the highlighted matched quote.

**Narration while evidence is visible:**

"AI extracts the claim and supporting quote, but Pulse does not trust the AI blindly. The quote is checked against the captured source text. If the quote is not found, the item is marked needs review and cannot become a high-priority alert."

"The score is also explainable. AI helps extract and write, but the risk score comes from clear factors: severity, source reliability, confidence, freshness, and vendor criticality."

**Screen:**

- Source Explorer.
- Bright Data trace table.
- Evidence Drawer.
- Quote verification view with highlighted match.
- Verified badge and score explanation.

**Judge takeaway:**

The wow moment is autonomous investigation plus verified evidence, not generic AI summarization.

## 2:15-2:45 — Result and Business Value

**Narration:**

"The agent now returns a structured vendor risk assessment. This is what the GRC lead can share with procurement before the renewal decision."

**Actions:**

1. Show the related-change card with two verified signals in the same review window.
2. Open or generate the Vendor Risk Assessment Brief.
3. Briefly show:
   - summary,
   - verified changes,
   - evidence table,
   - risk interpretation,
   - owner,
   - next action.

**Narration:**

"Instead of waiting for the next annual questionnaire or manually digging through alerts, SecurePay gets a source-backed assessment in minutes."

**Screen:**

- Related-change card.
- Vendor Risk Assessment Brief.

**Judge takeaway:**

Pulse saves review time, supports renewal decisions, and gives teams defensible evidence.

## 2:45-3:00 — Closing Pitch

**Narration:**

"Pulse is an autonomous vendor risk agent for lean GRC teams."

"It uses Bright Data to investigate live public web sources, AI to structure risk evidence, verification to keep claims trustworthy, and deterministic scoring to turn signals into action."

"It is not a chatbot and not alert spam. It is an auditable evidence agent for continuous vendor risk review."

**Screen:**

- End on the Vendor Risk Assessment Brief or Command Center with the verified alert visible.

**Judge takeaway:**

Pulse turns live public web data into trusted third-party risk decisions.

## What Must Work Live

- Command Center loads with the seeded SecurePay vendor watchlist.
- Demo vendor opens cleanly.
- **Vendor Risk Agent** toggle works.
- Agent status panel updates after enablement.
- Demo vendor shows next review as due now.
- Autonomous review cycle starts through scheduler or `agents/tick`.
- Review status strip progresses through Collect, Extract, Verify, Score, and Brief.
- At least one live Bright Data fetch is attempted.
- Bright Data trace rows are visible in Source Explorer.
- Source mode is honestly labeled as `live`, `cached`, or `fallback`.
- One high-priority alert opens successfully.
- Quote verification view shows a matched quote highlight.
- Support status displays as `verified`.
- Score explanation is visible.
- Vendor Risk Assessment Brief displays successfully.

## What Can Be Preloaded

- SecurePay watchlist.
- Demo vendor profile.
- Agent policy for the demo vendor.
- Cached fallback payload.
- Expected evidence items.
- Source excerpts for quote highlighting.
- Related-change card.
- Replay review-cycle data.
- Non-demo vendor alerts.
- Brief text generated from seeded verified evidence.

## What Screens to Show

1. **Command Center**
   - Show the watchlist, renewal urgency, risk signals, and agent status.

2. **Vendor Risk Agent Panel**
   - Show the toggle, autonomous monitoring mode, review policy, next review, and current activity.

3. **Review Status Strip**
   - Show the agent progressing through Collect, Extract, Verify, Score, and Brief.

4. **Source Explorer**
   - Show Bright Data trace rows and source-mode labels.

5. **Evidence Drawer**
   - Show claim, source URL, quote, support status, confidence, and score.

6. **Side-by-Side Quote Verification**
   - Show the main proof moment: extracted quote matched against captured source text.

7. **Vendor Risk Assessment Brief**
   - Show the final business artifact for GRC and procurement.

## What Not to Show

- Raw API keys, environment variables, or backend logs.
- Long JSON payloads.
- Database tables.
- Prompt engineering details.
- Internal stack traces or unhandled errors.
- Unfinished settings pages or non-MVP surfaces.
- Roadmap features such as Slack, Jira, SSO, RBAC, tenant isolation, or enterprise workflows.
- Broad market intelligence or competitor monitoring.
- Any private, credentialed, login-only, or unauthorized source.
- Multiple live review cycles that could slow down the demo.
- A primary **Run Scan** flow, because the demo should emphasize autonomous agent behavior.

## Backup Plan if Demo Fails

### If the agent does not start automatically

Say:

"For demo reliability, I will trigger the scheduler check. This is the same due-vendor check the agent runs automatically."

Then:

- Use `agents/tick` or the hidden recovery control.
- Show that the review cycle starts.
- Continue from the review status strip.

### If Bright Data live fetch fails

Say:

"Live web collection can fail or time out, so Pulse is designed to handle that transparently. It records the failed attempt, falls back to cached evidence, and labels the source mode."

Then:

- Show the failed or timed-out trace row.
- Show the cached or fallback trace row.
- Continue to verified evidence.

### If scan polling is slow

Say:

"I will switch to the preloaded review result. It uses the same evidence structure, trace format, and verification flow."

Then:

- Open the replay result.
- Continue from Source Explorer.

### If the quote view fails

Say:

"The safeguard is that high-priority alerts require verified source support. Here is the stored evidence item with its source URL, quote, support status, and score explanation."

Then:

- Show the Evidence Drawer.
- Point to verified status, source URL, quote, and score factors.

### If brief generation fails

Say:

"The brief is template-based from verified evidence. I will show the pre-generated version from this same review cycle."

Then:

- Open the preloaded Markdown or HTML brief.
- Continue with business value and closing pitch.

### If the entire app fails

Use the recorded backup video and narrate the same six-part story:

1. problem,
2. SecurePay setup,
3. Vendor Risk Agent enabled,
4. Bright Data trace proof,
5. verified quote evidence,
6. risk assessment brief.
