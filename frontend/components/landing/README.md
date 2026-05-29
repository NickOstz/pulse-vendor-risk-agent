# Pulse landing page + Sekreativ design system

This directory holds the marketing **landing page** (`/`), ported from the
Claude Design (claude.ai/design) **Sekreativ** handoff for Pulse. The interactive
**command center** lives at `/demo` and reuses the existing, fully API-wired
components in `frontend/components/` — only its presentation was restyled.

## Files

| File | Role |
|---|---|
| `LandingPage.tsx` | Composition + scroll-reveal hook. Rendered by `app/page.tsx`. |
| `icons.tsx` | Self-contained Lucide-style `Icon` set + `Sparkle`, `Wordmark`, `BrandImg`, `VendorLogo`. |
| `sections-hero.tsx` | `Nav`, `Hero` (live scan panel), `Problem` (blind-spot timeline), `Overview`. |
| `sections-how.tsx` | `HowItWorks` (5-stage loop), `BrightData` traces, `Evidence` proof. |
| `sections-product.tsx` | `ProductPreview` (command-center preview), `AlertChannels`, `McpServers`. |
| `sections-agent.tsx` | `AgentWork` — the 3 autonomous playbooks (AWS→Cloudflare migrate, Snowflake / Vercel contain). |
| `sections-close.tsx` | `Hackathon`, `FinalCta`, `Footer`. |

## Design system

All tokens, landing styles, and command-center styles live in
`app/sekreativ.css` (ported verbatim from the handoff's
`sekreativ-tokens.css` + `styles.css` + `demo.css`). Fonts are loaded via
`<link>` in `app/layout.tsx` (Space Grotesk, Mona Sans, Geologica, Unbounded,
Space Mono) and wired into `tailwind.config.ts` (`font-display`, `font-sans`,
`font-mono`, `font-poster`).

## Command-center re-skin

The repo already had a `data-theme="dark"` override layer in `app/globals.css`.
Rather than rewrite every component, those overrides were **repointed to the
Sekreativ palette** (near-black surfaces, hairline borders, amber accent, risk
colors) and expanded to cover the components' full Tailwind vocabulary
(including hover/focus states and dynamic class strings). The command center
now defaults to dark; its in-app light/dark toggle still works.

## Notes

- The landing page is fully interactive (auto-advancing loop, live scan feed,
  tabbed playbooks, hover timeline) and responsive from phone to ultrawide.
- Vendor/brand logos load from Google favicons + SimpleIcons (live CDNs) with
  graceful fallbacks; self-host them if you want zero external requests.
- The design's exploration-only "Tweaks panel" was intentionally omitted.
- Seeded copy/data (vendors, scores, MCP endpoints, evidence, playbooks) match
  `backend/app/seeds/companies.json` and `frontend/lib/*`.
