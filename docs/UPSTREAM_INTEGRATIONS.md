# Upstream Bright Data Integrations

## Pinned Sources

| Local path | Upstream repository | Pinned purpose |
| --- | --- | --- |
| `vendor/brightdata-hack-pack` | `ScrapeAlchemist/brightdata-hack-pack` | Hackathon docs and small REST/API examples |
| `vendor/brightdata-skills` | `brightdata/skills` | Bright Data agent guidance and API/SDK reference material |

Both upstream repositories are MIT-licensed and retain their license in their
submodule checkout. Do not remove those license files or copy upstream code
without preserving its license notice.

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

## Credential Policy

Each teammate may use their own Bright Data account locally. The shared
application consumes environment variable names only:

```text
BRIGHTDATA_API_KEY=
BRIGHTDATA_SERP_ZONE=
BRIGHTDATA_UNLOCKER_ZONE=
DEFAULT_REVIEW_MODE=live_with_fallback
```

Never place tokens in source, prompts, committed fixtures, URLs, screenshots,
logs committed to Git, or frontend `NEXT_PUBLIC_*` variables.
