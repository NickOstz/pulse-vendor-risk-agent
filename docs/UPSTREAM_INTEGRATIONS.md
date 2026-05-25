# Upstream Bright Data Integrations

## Pinned Sources

| Local path | Upstream repository | Pinned purpose |
| --- | --- | --- |
| `vendor/brightdata-hack-pack` | `ScrapeAlchemist/brightdata-hack-pack` | Hackathon docs and small REST/API examples |
| `vendor/brightdata-skills` | `brightdata/skills` | Bright Data agent guidance and API/SDK reference material |
| `vendor/claude-bright-data-research-agent` | `Stephen-Kimoi/claude-bright-data-research-agent` | Mentor tutorial reference for SERP/Web Unlocker collection and activity updates |

The first two upstream repositories contain MIT license files in their
submodule checkouts. At the inspected mentor-template commit, its README says
`MIT`, but it does not contain a standalone `LICENSE` file. Use the mentor
template as a pinned reference; do not copy its code into Pulse without
preserving attribution and confirming license treatment.

## Why Submodules

The upstream repositories are useful reference material but are not the Pulse
application. Submodules keep attribution and exact commits visible, avoid
copying an unrelated starter application into the product, and let every
teammate inspect the same reference version.

Set them up after cloning:

```bash
git submodule update --init --recursive
```

Update only intentionally, on a dedicated branch:

```bash
git submodule update --remote vendor/brightdata-hack-pack
git submodule update --remote vendor/brightdata-skills
git submodule update --remote vendor/claude-bright-data-research-agent
git add .gitmodules vendor/
git commit -m "chore: update Bright Data upstream references"
```

## What Pulse Should Reuse

Use `vendor/brightdata-hack-pack/docs/PRODUCTS.md`,
`docs/CHEATSHEET.md`, and the Python examples as references when building the
FastAPI collection wrapper and local credential smoke tests.

Use the following `vendor/brightdata-skills/skills/` references during backend
implementation:

| Pulse concern | Reference folder |
| --- | --- |
| Choosing REST/SDK paths for server code | `bright-data-best-practices/` |
| Python client implementation patterns | `python-sdk-best-practices/` |
| Search/discovery behavior | `search/` |
| Public-page markdown collection behavior | `scrape/` |
| MCP exploration or agent-tool experiments | `bright-data-mcp/` |

The skills upstream is described as a Claude Code plugin. In this repository,
Codex should use its Markdown and reference files as implementation guidance;
it should not assume Claude-specific plugin activation.

## Mentor Template Assessment

The [mentor tutorial](https://lablab.ai/ai-tutorials/claude-bright-data-research-agent-for-ai-hackathons)
and repository are useful for Pulse, but should not become the application
base. The repository is a Flask startup-research agent driven by a Claude
tool-use loop; Pulse has already committed to a Next.js frontend, FastAPI
backend, deterministic evidence verification, and a bounded vendor risk
workflow.

Reuse these concepts:

| Mentor pattern | Pulse adaptation |
| --- | --- |
| Server-side Bright Data `/request` calls using SERP and Web Unlocker zones | Implement behind `backend/app/services/brightdata_client.py` and persist every operation as a trace |
| SERP discovery followed by selected page collection | Restrict discovery to fixed vendor-risk query templates and scan budgets |
| Typed progress/activity events visible in a UI | Expose scan stage and Bright Data trace rows through the established polling API |
| Markdown report outcome | Render the Vendor Risk Assessment Brief from verified evidence only |

Do not reuse these as runtime behavior:

- the Flask application or its UI template,
- broad startup/funding research prompts,
- an unconstrained model-directed tool loop,
- client-visible credentials or untraced collection,
- any assertion that a claim is verified only because it appears in generated
  report text.

## Runtime Integration Decision

Pulse needs persisted trace telemetry and predictable failure handling.
Therefore the production demo path should call Bright Data from one
server-side FastAPI wrapper using REST or the Python SDK, with every operation
written to `brightdata_traces`.

Bright Data MCP remains useful for developer exploration and may be evaluated
later as a runtime tool, but it must not bypass Pulse trace logging,
eight-second timeout handling, review budgets, or fallback labels.

The initial active integration paths are:

| Need | Bright Data product | Pulse behavior |
| --- | --- | --- |
| Targeted adverse-media discovery | SERP API | Budgeted queries; log trace rows |
| Known public trust/pricing/terms page | Web Unlocker or markdown-capable scrape request | Capture text/markdown and hash snapshot |
| A public page that blocks normal collection | Web Unlocker fallback path | Log failed attempt and labeled fallback |

### Implemented Demo Mode

When `BRIGHTDATA_API_KEY`, `BRIGHTDATA_SERP_ZONE`, and
`DEFAULT_REVIEW_MODE=live_with_fallback` are configured, an autonomous review
cycle makes one server-side Bright Data SERP request for vendor-risk discovery
during the Collect stage. Its trace is recorded as `source_mode = live`.

When `BRIGHTDATA_UNLOCKER_ZONE` and `BRIGHTDATA_DEMO_SOURCE_URL` are also set,
the Collect stage makes one bounded Web Unlocker request for that explicit
public URL using Markdown output. A successful response is stored in the
ignored local live-snapshot directory and added to the scan content hashes;
the operation appears as a `web_unlocker` live trace.

The selected demo vendor is Cloudflare and the tested live URL is:

```text
BRIGHTDATA_DEMO_SOURCE_URL=https://www.cloudflare.com/trust-hub/
```

The curated fallback assessment uses short, source-supported excerpts from
official public pages:

| Signal | Public source |
| --- | --- |
| Compliance posture | `https://www.cloudflare.com/trust-hub/` |
| Data localization commercial scope | `https://developers.cloudflare.com/data-localization/` |
| Resolved Log Explorer status incident | `https://www.cloudflarestatus.com/` |

The evidence payload remains deterministic cached Cloudflare evidence while
live extraction is built. In this live-proof mode, cached evidence source rows
are recorded as `source_mode = fallback`, and the completed scan is marked
`completed_with_fallback`; the UI must not imply cached claims came from the
live request.

When Bright Data credentials are absent, review cycles use replay mode and
label source rows `cached`.

## Credential Policy

Each teammate may use their own Bright Data account locally. The shared
application consumes environment variable names only:

```text
BRIGHTDATA_API_KEY=
BRIGHTDATA_SERP_ZONE=
BRIGHTDATA_UNLOCKER_ZONE=
BRIGHTDATA_DEMO_SOURCE_URL=
BRIGHTDATA_LIVE_SNAPSHOT_DIR=
BRIGHTDATA_LIVE_FETCH_TIMEOUT_SECONDS=8
DEFAULT_REVIEW_MODE=live_with_fallback
```

Never place tokens in source, prompts, committed fixtures, URLs, screenshots,
logs committed to Git, or frontend `NEXT_PUBLIC_*` variables.

## Instruction Reference

`AGENTS.md` adapts selected engineering habits from the externally linked
[Karpathy-inspired CLAUDE.md](https://github.com/multica-ai/andrej-karpathy-skills/blob/main/CLAUDE.md):
surface material assumptions, keep implementations small, make focused
changes, and verify defined outcomes. Pulse's product boundaries and team
workflow take precedence over generic agent guidance.
