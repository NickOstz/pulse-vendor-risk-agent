"use client";

import { Icon, Sparkle, Wordmark, VendorLogo } from "./icons";
import { DEMO_URL } from "./sections-hero";

export const REPO_URL = "https://github.com/NickOstz/pulse-vendor-risk-agent";

const PARTNERS = [
  { name: "Bright Data", domain: "brightdata.com" },
  { name: "AWS", domain: "aws.amazon.com" },
  { name: "DeepSeek", domain: "deepseek.com" },
  { name: "AI/ML API", domain: "aimlapi.com" },
  { name: "lablab.ai", domain: "lablab.ai" },
  { name: "Kiro", domain: "kiro.dev" },
  { name: "Vercel", domain: "vercel.com" },
];

export function Hackathon() {
  const points = [
    { icon: "search", t: "Always-on web monitoring", d: "Targeted discovery and resilient capture across trust, security, pricing, status, and adverse-media sources, in real time." },
    { icon: "shield", t: "Evidence you can defend", d: "Source-backed findings and review-ready briefs routed to the right owner. No raw alert noise." },
    { icon: "zap", t: "An agent that acts", d: "Bounded autonomy: investigate, verify, score, and run scoped MCP actions when severity demands it." },
  ];
  return (
    <section className="section sect-alt">
      <div className="wrap">
        <div className="shead--center shead reveal">
          <span className="eyebrow">
            <span className="dot" /> Web Data UNLOCKED · Hackathon
          </span>
          <h2 className="display display--lg">
            Track 3 · Security &amp; Compliance,
            <br />
            Third-Party Risk.
          </h2>
          <p className="lede" style={{ textAlign: "center" }}>
            Bright Data is the engine behind Pulse, not an add-on. Live trace telemetry makes that visible to
            every judge.
          </p>
        </div>

        <div className="grid hack__pts reveal" style={{ marginTop: 56 }}>
          {points.map((p) => (
            <div key={p.t} className="panel hack__card">
              <Icon name={p.icon} size={22} />
              <h3 className="display display--md" style={{ fontSize: 20 }}>
                {p.t}
              </h3>
              <p style={{ color: "var(--fg-muted)", fontSize: 15, margin: 0 }}>{p.d}</p>
            </div>
          ))}
        </div>

        <div className="hack__stack reveal">
          <span className="fine">BUILT WITH</span>
          <div className="logowall">
            {PARTNERS.map((p) => (
              <div key={p.name} className="logowall__tile" title={p.name}>
                <VendorLogo domain={p.domain} size={26} />
                <span className="logowall__txt">{p.name}</span>
              </div>
            ))}
          </div>
          <p className="hack__tech">
            Bright Data SERP + Web Unlocker · AI/ML API (deepseek-v4-flash) with DeepSeek + Kiro fallback ·
            RapidFuzz quote verification · FastAPI + SQLite · Next.js 15 / React 19 · Model Context Protocol
          </p>
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="section finalcta">
      <div className="halo finalcta__halo" />
      <div className="wrap finalcta__inner reveal">
        <Sparkle size={28} style={{ color: "var(--accent)", marginBottom: 24 }} />
        <h2 className="display display--mega">
          Stop reviewing vendors
          <br />
          once a <span className="mark">year</span>.
        </h2>
        <p className="lede" style={{ marginInline: "auto", marginTop: 24, textAlign: "center" }}>
          Pulse is the autonomous, source-verified vendor-risk agent for lean GRC teams. See the full command
          center, the live Bright Data traces, and the agent at work.
        </p>
        <div className="finalcta__btns">
          <a className="btn btn--gradient btn--lg" href={DEMO_URL}>
            Launch the live demo <Icon name="arrowUR" size={18} />
          </a>
          <a className="btn btn--ghost btn--lg" href={REPO_URL} target="_blank" rel="noreferrer">
            <Icon name="link" size={17} /> View the repository
          </a>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const cols: [string, [string, string][]][] = [
    [
      "Product",
      [
        ["The problem", "#problem"],
        ["How it works", "#how"],
        ["The agent", "#agent"],
        ["Evidence", "#evidence"],
      ],
    ],
    [
      "Resources",
      [
        ["Live demo", DEMO_URL],
        ["GitHub repo", REPO_URL],
        ["Hackathon", "https://lablab.ai/ai-hackathons/brightdata-ai-agents-web-data-hackathon"],
      ],
    ],
  ];
  return (
    <footer className="footer">
      <div className="wrap footer__inner">
        <div className="footer__brand">
          <Wordmark size={26} />
          <p className="fine" style={{ marginTop: 16, maxWidth: 280, lineHeight: 1.7 }}>
            Autonomous vendor risk agent. Public-web evidence only. Pulse produces review signals, not legal
            conclusions.
          </p>
          <span className="badge mono" style={{ marginTop: 18, color: "var(--fg-faint)" }}>
            POWERED BY BRIGHT DATA
          </span>
        </div>
        <div className="footer__cols">
          {cols.map(([h, links]) => (
            <div key={h} className="footer__col">
              <span className="fine">{h.toUpperCase()}</span>
              {links.map(([t, href]) => (
                <a key={t} href={href} target={/^https?:/.test(href) ? "_blank" : undefined} rel="noreferrer">
                  {t}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="wrap footer__bottom">
        <span className="fine">© 2026 Pulse · Web Data UNLOCKED Hackathon</span>
        <span className="fine">Autonomous vendor risk, source-verified.</span>
      </div>
    </footer>
  );
}
