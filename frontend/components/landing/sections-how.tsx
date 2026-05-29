"use client";

import { useState, useEffect } from "react";
import { Icon } from "./icons";

/* ============================== HOW IT WORKS ============================== */
const STAGES = [
  {
    key: "collect",
    n: "01",
    name: "Collect",
    icon: "globe",
    head: "Bright Data reads the live public web",
    desc: "Each review cycle runs bounded SERP discovery and captures approved public pages across trust, security, pricing, terms, status, and targeted adverse-media results. Every fetch is traced.",
    tag: "≤ 6 SERP queries · ≤ 12 URLs · 8s timeout",
  },
  {
    key: "extract",
    n: "02",
    name: "Extract",
    icon: "layers",
    head: "AI structures the evidence, strictly",
    desc: "AI/ML API (deepseek-v4-flash) pulls each finding into a strict JSON schema, with DeepSeek then Kiro as fallback. Pydantic validates before anything is stored, and malformed output is retried once.",
    tag: "3 signal templates · schema-validated",
  },
  {
    key: "verify",
    n: "03",
    name: "Verify",
    icon: "checkCircle",
    head: "Every quote is checked against its source",
    desc: "RapidFuzz matches the supporting quote against the captured source text. If it isn't present above the 0.8 threshold, the finding is marked needs-review and can never become a high-priority alert.",
    tag: "threshold 0.8 · verified / needs-review",
  },
  {
    key: "score",
    n: "04",
    name: "Score",
    icon: "gauge",
    head: "Deterministic scoring. The model never sets the number",
    desc: "Verified signals are scored in code from explainable factors. The result is a 0-100 index, capped, with the top contributing evidence always visible.",
    tag: "explainable · reproducible",
  },
  {
    key: "brief",
    n: "05",
    name: "Brief",
    icon: "doc",
    head: "A review-ready vendor risk assessment",
    desc: "Pulse assembles a brief a GRC lead could send to procurement: summary, verified changes, evidence table, risk interpretation, owner, and next action, in Markdown or HTML.",
    tag: "summary · evidence · owner · action",
  },
];

function StageArtifact({ k }: { k: string }) {
  if (k === "collect")
    return (
      <div className="art">
        {(
          [
            ["SERP", 'vendor + "trust" "SOC 2"', "200", "live"],
            ["UNLOCKER", "cloudflare.com/trust-hub", "200", "live"],
            ["SCRAPE", "paddle.com/legal/terms", "200", "cached"],
          ] as const
        ).map((r, i) => (
          <div key={i} className="tracerow">
            <span className="badge mono" style={{ fontSize: 9, padding: "3px 6px", color: "var(--fg-muted)" }}>
              {r[0]}
            </span>
            <span className="mono tracerow__url">{r[1]}</span>
            <span className="mono" style={{ color: "var(--ok)" }}>
              {r[2]}
            </span>
            <span className={"srcmode srcmode--" + r[3]}>{r[3]}</span>
          </div>
        ))}
      </div>
    );
  if (k === "extract")
    return (
      <pre className="art art--code mono">{`{
  "signal_type": "trust_security",
  "claim": "SOC 2 Type II + ISO 27001
     listed in compliance resources",
  "supporting_quote": "…ISO 27001,
     ISO 27701, PCI DSS, SOC 2 Type II…",
  "source_url": "cloudflare.com/trust-hub",
  "severity_hint": "medium",
  "confidence": 0.95
}`}</pre>
    );
  if (k === "verify")
    return (
      <div className="art" style={{ gap: 14 }}>
        <div className="qmatch">
          <span>Quote match</span>
          <b className="mono" style={{ color: "var(--ok)" }}>
            0.91
          </b>
        </div>
        <div className="qbar">
          <i style={{ width: "91%" }} />
        </div>
        <div className="qmatch" style={{ color: "var(--fg-muted)", fontSize: 13 }}>
          <span>
            <Icon name="check" size={13} /> Found in captured source
          </span>
          <span className="badge badge--verified">VERIFIED</span>
        </div>
        <div
          className="qmatch"
          style={{ color: "var(--fg-faint)", fontSize: 12.5, borderTop: "1px dashed var(--hair)", paddingTop: 10 }}
        >
          <span>Below 0.8 → blocked</span>
          <span className="badge badge--med" style={{ opacity: 0.8 }}>
            NEEDS REVIEW
          </span>
        </div>
      </div>
    );
  if (k === "score")
    return (
      <div className="art art--score">
        <div className="formula mono">Severity × Source × Confidence × Freshness × Criticality</div>
        <div className="factorrow">
          {(
            [
              ["Severity", ".9"],
              ["Source", ".9"],
              ["Conf.", ".86"],
              ["Fresh", ".95"],
              ["Crit.", "1.2"],
            ] as const
          ).map((f) => (
            <div key={f[0]} className="factor">
              <span>{f[0]}</span>
              <b className="mono">{f[1]}</b>
            </div>
          ))}
        </div>
        <div className="scoreout">
          <span className="display tnum" style={{ fontSize: 44 }}>
            71
          </span>
          <span>
            <span className="badge badge--high">HIGH</span>
            <div className="fine" style={{ marginTop: 6 }}>
              display index · capped at 100
            </div>
          </span>
        </div>
      </div>
    );
  return (
    <div className="art art--brief">
      <div className="briefdoc">
        <div className="briefdoc__h">
          <Icon name="doc" size={15} /> Vendor Risk Assessment · Cloudflare
        </div>
        <div className="briefline" style={{ width: "92%" }} />
        <div className="briefline" style={{ width: "78%" }} />
        <div className="briefchip">2 verified changes · renewal in 41 days</div>
        <div className="briefline" style={{ width: "64%" }} />
        <div className="briefline briefline--accent" style={{ width: "48%" }} />
      </div>
    </div>
  );
}

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setActive((a) => (a + 1) % STAGES.length), 2600);
    return () => clearInterval(t);
  }, [auto]);
  const s = STAGES[active];
  return (
    <section id="how" className="section sect-alt">
      <div className="wrap">
        <div className="shead reveal">
          <span className="eyebrow">
            <span className="dot" /> How it works
          </span>
          <h2 className="display display--xl">
            One bounded loop.
            <br />
            Five accountable steps.
          </h2>
          <p className="lede">
            Enable the agent once. When a vendor is due, Pulse runs an autonomous review cycle and shows its
            work at every stage.
          </p>
        </div>

        <div className="loop reveal">
          <div className="loop__strip">
            {STAGES.map((st, i) => (
              <button
                key={st.key}
                className={"loopstep" + (i === active ? " loopstep--on" : "") + (i < active ? " loopstep--done" : "")}
                onClick={() => {
                  setActive(i);
                  setAuto(false);
                }}
              >
                <span className="loopstep__n mono">{st.n}</span>
                <Icon name={i < active ? "check" : st.icon} size={20} />
                <span className="loopstep__name">{st.name}</span>
                {i < STAGES.length - 1 && (
                  <span className="loopstep__arr">
                    <Icon name="arrow" size={15} />
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="loop__rail">
            <span className="loop__railfill" style={{ width: (active / (STAGES.length - 1)) * 100 + "%" }} />
          </div>

          <div className="loop__detail panel">
            <div className="loop__left loop__anim" key={"l" + s.key}>
              <span className="eyebrow eyebrow--accent">
                {s.n} · {s.name}
              </span>
              <h3 className="display display--md" style={{ marginTop: 14 }}>
                {s.head}
              </h3>
              <p style={{ color: "var(--fg-muted)", fontSize: 16, marginTop: 12 }}>{s.desc}</p>
              <span className="pill mono" style={{ marginTop: 8, fontSize: 11.5 }}>
                {s.tag}
              </span>
            </div>
            <div className="loop__right loop__anim" key={"r" + s.key}>
              <StageArtifact k={s.key} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================== BRIGHT DATA ============================== */
export function BrightData() {
  const traces: [string, string, string, string, string][] = [
    ["SERP API", 'discovery · "cloudflare soc 2"', "200", "180ms", "live"],
    ["Web Unlocker", "cloudflare.com/trust-hub", "200", "1.2s", "live"],
    ["Scrape", "cloudflare.com/privacy", "200", "340ms", "cached"],
    ["Web Unlocker", "status.cloudflare.com", "408", "8.0s", "fallback"],
  ];
  return (
    <section className="section">
      <div className="wrap brightdata">
        <div className="brightdata__copy reveal">
          <span className="eyebrow">
            <span className="dot" /> Powered by Bright Data
          </span>
          <h2 className="display display--lg" style={{ marginTop: 16 }}>
            Source coverage internal tools can&apos;t match.
          </h2>
          <p className="lede" style={{ marginTop: 16 }}>
            All collection happens server-side. Pulse uses Bright Data&apos;s SERP API for discovery and Web
            Unlocker for resilient public-page capture, then records a full trace for every operation,
            honestly labeled <b className="accent-text">live</b>, <b style={{ color: "var(--fg)" }}>cached</b>, or{" "}
            <b style={{ color: "var(--risk-med)" }}>fallback</b>.
          </p>
          <ul className="checklist">
            {[
              "Credentials never leave the backend",
              "Every fetch is logged with latency & status",
              "Failed live calls fall back transparently, never silently",
            ].map((c) => (
              <li key={c}>
                <Icon name="check" size={16} /> {c}
              </li>
            ))}
          </ul>
        </div>
        <div className="brightdata__panel panel reveal">
          <div className="tracehead fine">
            <span>BRIGHT DATA TRACE · scan #4821</span>
            <span className="livedot" />
          </div>
          <div className="tracetable">
            <div className="tracetable__h fine">
              <span>OPERATION</span>
              <span>SOURCE</span>
              <span>STATUS</span>
              <span>LATENCY</span>
              <span>MODE</span>
            </div>
            {traces.map((t, i) => (
              <div key={i} className="tracetable__r">
                <span className="mono" style={{ color: "var(--fg)" }}>
                  {t[0]}
                </span>
                <span className="mono tracerow__url">{t[1]}</span>
                <span className="mono" style={{ color: t[2] === "200" ? "var(--ok)" : "var(--risk-med)" }}>
                  {t[2]}
                </span>
                <span className="mono">{t[3]}</span>
                <span className={"srcmode srcmode--" + t[4]}>{t[4]}</span>
              </div>
            ))}
          </div>
          <div className="tracefoot fine">
            <Icon name="shield" size={13} /> 4 operations · 1 fallback handled · 0 credentials exposed
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================== EVIDENCE PROOF ============================== */
const SOURCE_TEXT = `Compliance resources: `;
const MATCH = `Explore our posture around ISO 27001, ISO 27701, PCI DSS, SOC 2 Type II, and others`;
const SOURCE_TAIL = `.`;

export function Evidence() {
  return (
    <section id="evidence" className="section sect-alt">
      <div className="wrap">
        <div className="shead reveal">
          <span className="eyebrow">
            <span className="dot" /> The proof moment
          </span>
          <h2 className="display display--xl">
            No verified quote,
            <br />
            no high-priority alert.
          </h2>
          <p className="lede">
            Pulse never asks you to trust the AI. Every high-priority finding shows the captured source text
            with the matched quote highlighted, right next to the claim and its score.
          </p>
        </div>

        <div className="evidence reveal">
          <div className="evidence__src panel">
            <div className="evidence__lbl fine">
              <Icon name="globe" size={13} /> CAPTURED SOURCE · cloudflare.com/trust-hub
            </div>
            <p className="evidence__text">
              {SOURCE_TEXT}
              <mark className="qhl">{MATCH}</mark>
              {SOURCE_TAIL}
            </p>
            <div className="evidence__meta fine">
              Captured 2026-05-26 03:45 UTC · Bright Data Web Unlocker ·{" "}
              <span className="srcmode srcmode--live" style={{ display: "inline-flex" }}>
                live
              </span>
            </div>
          </div>

          <div className="evidence__claim panel panel--2">
            <div className="evidence__top">
              <span className="badge badge--verified">
                <Icon name="checkCircle" size={12} /> VERIFIED
              </span>
              <span className="badge badge--med">MEDIUM</span>
            </div>
            <div className="eyebrow eyebrow--accent" style={{ marginTop: 18 }}>
              Extracted claim · trust_security
            </div>
            <h3 className="display display--md" style={{ fontSize: 22, marginTop: 10 }}>
              Cloudflare publicly identifies SOC 2 Type II and ISO 27001 among its compliance resources.
            </h3>
            <div className="evidence__quote">
              <Icon name="quote" size={16} /> &quot;{MATCH}&quot;
            </div>
            <div className="evidence__factors">
              <div className="fine" style={{ marginBottom: 10 }}>
                SCORE EXPLANATION
              </div>
              <div className="factorrow factorrow--wrap">
                {(
                  [
                    ["Severity", "0.6"],
                    ["Source", "0.9"],
                    ["Confidence", "0.95"],
                    ["Freshness", "1.0"],
                    ["Criticality", "1.2"],
                  ] as const
                ).map((f) => (
                  <div key={f[0]} className="factor">
                    <span>{f[0]}</span>
                    <b className="mono">{f[1]}</b>
                  </div>
                ))}
              </div>
              <div className="evidence__score">
                <span>Display index</span>
                <span className="display tnum" style={{ fontSize: 34 }}>
                  62<span style={{ fontSize: 16, color: "var(--fg-faint)" }}>/100</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
