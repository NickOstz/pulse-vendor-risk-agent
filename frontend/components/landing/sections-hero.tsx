"use client";

import { useState, useEffect } from "react";
import { Icon, Sparkle, Wordmark, VendorLogo } from "./icons";

export const DEMO_URL = "/demo";

/* ============================== NAV ============================== */
export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const links: [string, string][] = [
    ["The problem", "#problem"],
    ["How it works", "#how"],
    ["The agent", "#agent"],
    ["Evidence", "#evidence"],
  ];
  return (
    <nav className={"nav" + (scrolled ? " nav--scrolled" : "")}>
      <div className="wrap nav__inner">
        <a href="#top" aria-label="Pulse home">
          <Wordmark />
        </a>
        <div className="nav__links" style={{ display: "flex" }}>
          {links.map(([t, h]) => (
            <a key={h} href={h} className="nav__hide">
              {t}
            </a>
          ))}
          <a
            className="btn btn--gradient"
            style={{ padding: "10px 20px", fontSize: 14.5 }}
            href={DEMO_URL}
          >
            Launch demo <Icon name="arrowUR" size={15} />
          </a>
        </div>
      </div>
    </nav>
  );
}

/* ============================== HERO ============================== */
const SCAN_FEED = [
  { v: "Cloudflare", d: "cloudflare.com", s: "cloudflare.com/trust-hub", sig: "Trust posture" },
  { v: "AWS", d: "aws.amazon.com", s: "aws.amazon.com/security", sig: "Operational" },
  { v: "Vercel", d: "vercel.com", s: "vercel.com/security", sig: "Adverse media" },
  { v: "Snowflake", d: "snowflake.com", s: "snowflake.com/security-hub", sig: "Adverse media" },
  { v: "Paddle", d: "paddle.com", s: "paddle.com/legal/terms", sig: "Pricing / terms" },
];

function HeroLivePanel() {
  const [idx, setIdx] = useState(0);
  const [count, setCount] = useState(38);
  useEffect(() => {
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % SCAN_FEED.length);
      setCount((c) => c + 1);
    }, 2000);
    return () => clearInterval(t);
  }, []);
  const cur = SCAN_FEED[idx];
  return (
    <div className="hero-panel panel">
      <div className="hero-panel__top">
        <span
          className="pill"
          style={{ borderColor: "rgba(47,224,122,0.4)", color: "var(--ok)", background: "rgba(47,224,122,0.06)" }}
        >
          <span className="livedot" /> Agent online
        </span>
        <span className="badge mono" style={{ color: "var(--fg-faint)" }}>
          AUTONOMOUS
        </span>
      </div>
      <div className="hero-panel__scan">
        <div className="radar">
          <span />
          <span />
          <span />
          <i />
        </div>
        <div className="hero-panel__cur">
          <div className="fine" style={{ marginBottom: 6 }}>
            NOW COLLECTING · LIVE
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <VendorLogo domain={cur.d} size={22} />
            <div className="display display--md" style={{ fontSize: 22, lineHeight: 1.05 }}>
              {cur.v}
            </div>
          </div>
          <div className="mono" style={{ fontSize: 12, color: "var(--accent)", marginTop: 7 }}>
            {cur.s}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--fg-muted)", marginTop: 4 }}>{cur.sig} signal</div>
        </div>
      </div>
      <div className="hero-panel__feed">
        {SCAN_FEED.map((f, i) => (
          <div key={f.v} className={"feedrow" + (i === idx ? " feedrow--on" : "")}>
            <VendorLogo domain={f.d} size={15} />
            <span className="feedrow__v">{f.v}</span>
            <span className="feedrow__s mono">{f.s}</span>
            {i !== idx ? (
              <span className="badge badge--verified" style={{ fontSize: 9.5, padding: "3px 7px" }}>
                VERIFIED
              </span>
            ) : (
              <Icon name="search" size={13} style={{ color: "var(--accent)" }} />
            )}
          </div>
        ))}
      </div>
      <div className="hero-panel__foot">
        <div>
          <span className="display tnum" style={{ fontSize: 30 }}>
            {count}
          </span>{" "}
          <span className="fine">signals verified today</span>
        </div>
        <div className="fine">via Bright Data</div>
      </div>
    </div>
  );
}

export function Hero({ layout = "split" }: { layout?: string }) {
  return (
    <header id="top" className={"hero hero--" + layout}>
      <div className="halo hero__halo" />
      <div className="halo hero__halo2" />
      <div className="wrap hero__inner">
        <div className="hero__copy">
          <div className="eyebrow eyebrow--accent reveal" style={{ marginBottom: 26 }}>
            <Sparkle size={13} /> Autonomous Vendor Risk Agent
          </div>
          <h1 className="display display--mega reveal">
            Know what changed
            <br />
            before you <span className="mark">renew</span>.
          </h1>
          <p className="lede reveal" style={{ marginTop: 24, transitionDelay: ".05s" }}>
            Vendor reviews happen once a year, but vendor risk shifts in real time. Pulse watches your
            critical vendors on the live public web, checks every claim against its real source, and gives
            you a review-ready risk assessment. Automatically.
          </p>
          <div className="hero__cta reveal" style={{ transitionDelay: ".1s" }}>
            <a className="btn btn--gradient btn--lg" href={DEMO_URL}>
              Launch the live demo <Icon name="arrowUR" size={18} />
            </a>
            <a className="btn btn--ghost btn--lg" href="#how">
              See how it works
            </a>
          </div>
          <div className="hero__trust reveal" style={{ transitionDelay: ".15s" }}>
            <span className="pill">
              <Icon name="brightdata" className="ic" /> Powered by Bright Data
            </span>
            <span className="pill">
              <Icon name="shield" className="ic" /> Source-verified evidence
            </span>
            <span className="pill">
              <Icon name="gauge" className="ic" /> Deterministic scoring
            </span>
          </div>
        </div>
        <div className="hero__panel reveal" style={{ transitionDelay: ".12s" }}>
          <HeroLivePanel />
        </div>
      </div>
      <a href="#problem" className="hero__scroll fine" aria-label="Scroll to content">
        SCROLL <Icon name="chevron" size={14} />
      </a>
    </header>
  );
}

/* ============================== PROBLEM ============================== */
const CHANGE_EVENTS: { at: number; label: string; tone: string }[] = [
  { at: 14, label: "Trust page quietly updated", tone: "med" },
  { at: 31, label: "Status-page outage", tone: "high" },
  { at: 52, label: "Pricing & terms changed", tone: "med" },
  { at: 68, label: "Breach mention in the press", tone: "high" },
  { at: 86, label: "New sub-processor added", tone: "low" },
];

export function Problem() {
  const alts = [
    { icon: "calendar", t: "Annual questionnaires", d: "Stale by design. The answers describe a vendor that existed twelve months ago." },
    { icon: "activity", t: "Google Alerts", d: "Noisy and unaudited. No source provenance, no verification, no risk context." },
    { icon: "clock", t: "Manual analyst work", d: "Slow, inconsistent, impossible to reproduce, and lean teams don't have the analysts." },
  ];
  return (
    <section id="problem" className="section">
      <div className="wrap">
        <div className="shead reveal">
          <span className="eyebrow">
            <span className="dot" /> The problem
          </span>
          <h2 className="display display--xl">
            Reviews happen <span className="grad-text">once a year</span>.
            <br />
            Risk changes every week.
          </h2>
          <p className="lede">
            Between two formal reviews, a vendor can change its security posture, raise prices, suffer an
            outage, or land in the press. By the time the next questionnaire goes out, the renewal is
            already signed.
          </p>
        </div>

        <div className="timeline reveal">
          <div className="tl">
            <div className="tl__head">
              <span className="tl__tag">
                <i />
                Annual review
              </span>
              <span className="tl__blind">12 months of blind spots</span>
              <span className="tl__tag">
                Next review
                <i />
              </span>
            </div>
            <div className="tl__line">
              <span className="tl__cap tl__cap--l" />
              <span className="tl__cap tl__cap--r" />
              {CHANGE_EVENTS.map((e) => (
                <div key={e.at} className={"tl__evt tl__evt--" + e.tone} style={{ left: e.at + "%" }}>
                  <i />
                  <div className="tl__tip">{e.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="timeline__caption fine">
            Hover the markers. Every one of these is a public signal nobody is watching.
          </div>
        </div>

        <div className="grid prob__alts reveal" style={{ marginTop: 64 }}>
          {alts.map((a) => (
            <div key={a.t} className="panel prob__card">
              <Icon name={a.icon} size={22} />
              <h3 className="display display--md" style={{ fontSize: 21 }}>
                {a.t}
              </h3>
              <p style={{ color: "var(--fg-muted)", fontSize: 15.5, margin: 0 }}>{a.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================== OVERVIEW (WHAT PULSE DOES) ============================== */
export function Overview() {
  const pillars = [
    { n: "01", icon: "radar", t: "It watches", d: "Bright Data collects trust, security, pricing, status, and adverse-media sources for every critical vendor, around the clock.", tag: "Live public web" },
    { n: "02", icon: "checkCircle", t: "It verifies", d: "AI extracts each claim, then Pulse checks the quote against the real captured source. No match, no alert.", tag: "Quote-verified" },
    { n: "03", icon: "zap", t: "It acts", d: "Verified high-severity signals trigger scoped playbooks through vendor MCP servers, with a full execution log.", tag: "Autonomous + scoped" },
  ];
  return (
    <section className="section section--tight">
      <div className="wrap">
        <div className="shead reveal">
          <span className="eyebrow">
            <span className="dot" /> What Pulse does
          </span>
          <h2 className="display display--xl">
            Watch. Verify. Act.
            <br />
            In real time.
          </h2>
          <p className="lede">
            Pulse turns the live public web into trusted vendor-risk decisions, so a lean team can see what
            changed before it becomes a renewal, audit, or incident problem.
          </p>
        </div>
        <div className="grid pillars reveal">
          {pillars.map((p) => (
            <div key={p.n} className="panel pillar">
              <div className="pillar__top">
                <span className="pillar__ic">
                  <Icon name={p.icon} size={20} />
                </span>
                <span className="mono pillar__n">{p.n}</span>
              </div>
              <h3 className="display display--md">{p.t}</h3>
              <p className="pillar__d">{p.d}</p>
              <span className="pill mono pillar__tag">{p.tag}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
