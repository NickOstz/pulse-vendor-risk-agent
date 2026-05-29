"use client";

import { useState } from "react";
import { Icon, Wordmark, VendorLogo, BrandImg } from "./icons";

type Vendor = {
  name: string;
  domain: string;
  owner: string;
  score: number;
  level: string;
  tone: string;
  renew: string;
  mcp: string;
  days: number;
};

const VENDORS: Vendor[] = [
  { name: "Cloudflare", domain: "cloudflare.com", owner: "Security", score: 62, level: "High", tone: "high", renew: "Jul 10, 2026", mcp: "https://mcp.cloudflare.com/mcp", days: 41 },
  { name: "AWS", domain: "aws.amazon.com", owner: "IT", score: 77, level: "High", tone: "high", renew: "Dec 31, 2026", mcp: "https://aws-mcp.us-east-1.api.aws/mcp", days: 215 },
  { name: "Vercel", domain: "vercel.com", owner: "Engineering", score: 71, level: "High", tone: "high", renew: "Dec 31, 2026", mcp: "https://mcp.vercel.com", days: 215 },
  { name: "Snowflake", domain: "snowflake.com", owner: "Data", score: 50, level: "Medium", tone: "med", renew: "Jan 20, 2027", mcp: "https://account.snowflakecomputing.com/api/v2", days: 235 },
  { name: "Paddle", domain: "paddle.com", owner: "Finance", score: 21, level: "Low", tone: "low", renew: "Dec 14, 2026", mcp: "https://paddle-mcp.paddle.com/connect", days: 198 },
];

function ScoreBadge({ score, level, tone }: { score: number; level: string; tone: string }) {
  return (
    <span className={"scorebadge scorebadge--" + tone}>
      <b className="tnum">{score}</b> {level}
    </span>
  );
}

function PreviewVendorCard({ v, selected, onSelect }: { v: Vendor; selected: boolean; onSelect: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={"vcard" + (selected ? " vcard--on" : "")} onClick={onSelect}>
      <div className="vcard__top">
        <div className="vcard__id">
          <VendorLogo domain={v.domain} size={20} />
          <div>
            <div className="vcard__name">{v.name}</div>
            <div className="vcard__dom mono">{v.domain}</div>
          </div>
        </div>
        <ScoreBadge score={v.score} level={v.level} tone={v.tone} />
      </div>
      <div className="vcard__meta">
        <div>
          <span className="fine">OWNER</span>
          <b>{v.owner}</b>
        </div>
        <div>
          <span className="fine">RENEWAL</span>
          <b>{v.renew}</b>
        </div>
      </div>
      <button
        className="vcard__mcp"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <span className="livedot" style={{ width: 7, height: 7 }} /> MCP server connected
        <Icon
          name="chevron"
          size={14}
          style={{ marginLeft: "auto", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}
        />
      </button>
      {open && (
        <div className="vcard__link mono">
          <Icon name="link" size={12} /> {v.mcp}
        </div>
      )}
    </div>
  );
}

export function ProductPreview() {
  const [sel, setSel] = useState(0);
  const [agentOn, setAgentOn] = useState(true);
  const badges: [string, string][] = [
    ["PULSE MVP", "mono"],
    ["LIVE API MODE", "live"],
    ["DEMO READY", "mono"],
    ["CONTROLS LOCKED", "lock"],
  ];
  return (
    <section id="product" className="section">
      <div className="wrap">
        <div className="shead reveal">
          <span className="eyebrow">
            <span className="dot" /> The command center
          </span>
          <h2 className="display display--xl">
            Your whole vendor portfolio,
            <br />
            sorted by what needs you now.
          </h2>
          <p className="lede">
            One dense surface: the watchlist ranked by risk and renewal urgency, the agent in autonomous
            mode, and live connection to each vendor&apos;s MCP server.
          </p>
        </div>

        <div className="cc reveal">
          <div className="cc__chrome">
            <div className="cc__bcrumb">
              <Wordmark size={16} /> <span className="fine">/ command center</span>
            </div>
            <div className="cc__badges">
              {badges.map(([b, k]) => (
                <span
                  key={b}
                  className={"ccbadge" + (k === "live" ? " ccbadge--live" : k === "lock" ? " ccbadge--lock" : "")}
                >
                  {k === "live" && <span className="livedot" style={{ width: 6, height: 6 }} />}
                  {k === "lock" && <Icon name="lock" size={11} />}
                  {b}
                </span>
              ))}
            </div>
          </div>

          <div className="cc__body">
            <div className="cc__list">
              <div className="cc__listhead">
                <span>Vendor watchlist</span>
                <span className="fine">5 / 5 monitored</span>
              </div>
              {VENDORS.map((v, i) => (
                <PreviewVendorCard key={v.name} v={v} selected={sel === i} onSelect={() => setSel(i)} />
              ))}
            </div>

            <div className="cc__agent">
              <div className="agentcard panel">
                <div className="agentcard__head">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Icon name="shield" size={18} style={{ color: "var(--accent)" }} />
                    <b>Vendor Risk Agent</b>
                  </div>
                  <button
                    className={"toggle" + (agentOn ? " toggle--on" : "")}
                    onClick={() => setAgentOn((o) => !o)}
                    aria-label="Toggle agent"
                  >
                    <Icon name="power" size={13} />
                    <span className="toggle__knob" />
                  </button>
                </div>
                <p className="agentcard__desc">
                  Autonomous monitoring for public vendor-risk evidence. Collection and credentials stay
                  server-side.
                </p>
                <div className={"agentcard__status" + (agentOn ? "" : " agentcard__status--off")}>
                  {(
                    [
                      ["target", "Review policy", "Realtime monitoring"],
                      ["clock", "Next sweep", "Continuous watch"],
                      ["activity", "Current activity", agentOn ? "Watching public sources for vendor-risk signals" : "Paused"],
                      ["checkCircle", "Latest assessment", "Completed"],
                    ] as [string, string, string][]
                  ).map((r) => (
                    <div key={r[1]} className="statusrow">
                      <Icon name={r[0]} size={16} />
                      <div>
                        <div className="fine">{r[1]}</div>
                        <b>{r[2]}</b>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="agentcard__foot">
                  <span
                    className="badge mono"
                    style={{ color: agentOn ? "var(--ok)" : "var(--fg-faint)", borderColor: "currentColor" }}
                  >
                    {agentOn ? "AUTONOMOUS" : "INACTIVE"}
                  </span>
                  <span className="fine">Selected: {VENDORS[sel].name}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="fine reveal" style={{ textAlign: "center", marginTop: 18 }}>
          Live, interactive preview. Toggle the agent, pick a vendor, or open an MCP connection. The full
          build runs on Vercel.
        </p>
      </div>
    </section>
  );
}

/* ============================== ALERT CHANNELS ============================== */
type Channel = { key: string; slug: string; color: string; domain: string; name: string; val: string; hint: string };

const CHANNELS: Channel[] = [
  { key: "email", slug: "gmail", color: "EA4335", domain: "gmail.com", name: "Email", val: "ri···m@gmail.com", hint: "Verified alerts to the vendor owner" },
  { key: "wa", slug: "whatsapp", color: "25D366", domain: "whatsapp.com", name: "WhatsApp", val: "+620···888", hint: "Urgent signals, push to phone" },
  { key: "discord", slug: "discord", color: "5865F2", domain: "discord.com", name: "Discord webhook", val: "https://discord.com/api/webhooks/···/···", hint: "Pipe to your security channel" },
];

function ChannelCard({ c }: { c: Channel }) {
  const [ready, setReady] = useState(true);
  const [busy, setBusy] = useState(false);
  const verify = () => {
    setBusy(true);
    setReady(false);
    setTimeout(() => {
      setBusy(false);
      setReady(true);
    }, 900);
  };
  return (
    <div className="channel panel">
      <div className="channel__head">
        <span className="channel__ico">
          <BrandImg
            src={`https://cdn.simpleicons.org/${c.slug}/${c.color}`}
            alt={c.name}
            width={20}
            height={20}
            fallback={<VendorLogo domain={c.domain} size={20} />}
          />
        </span>
        <b>{c.name}</b>
      </div>
      <div className="channel__row">
        <input className="channel__input mono" defaultValue={c.val} aria-label={c.name} />
        <button
          className={"channel__verify" + (ready ? " channel__verify--ok" : "")}
          onClick={verify}
          aria-label="Verify channel"
        >
          <Icon name={busy ? "refresh" : "check"} size={15} className={busy ? "spin" : ""} />
        </button>
      </div>
      <div className="channel__status fine">
        {busy ? (
          <>
            <Icon name="refresh" size={12} className="spin" /> Verifying…
          </>
        ) : ready ? (
          <>
            <Icon name="checkCircle" size={12} style={{ color: "var(--ok)" }} /> Ready
          </>
        ) : (
          "Not set"
        )}
        <span style={{ marginLeft: "auto", color: "var(--fg-faint)" }}>{c.hint}</span>
      </div>
    </div>
  );
}

export function AlertChannels() {
  return (
    <section className="section sect-alt">
      <div className="wrap">
        <div className="shead reveal">
          <span className="eyebrow">
            <span className="dot" /> Route verified alerts
          </span>
          <h2 className="display display--lg">
            When a signal is verified,
            <br />
            the right person hears about it.
          </h2>
          <p className="lede">
            Only verified, high-priority findings page a human. Connect the channels once and Pulse routes
            every confirmed alert in real time.
          </p>
        </div>
        <div className="grid channels reveal">
          {CHANNELS.map((c) => (
            <ChannelCard key={c.key} c={c} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================== MCP SERVERS ============================== */
type Mcp = { name: string; region: string; url: string; scope: string };

const MCP: Mcp[] = [
  { name: "AWS MCP", region: "us-east-1", url: "https://aws-mcp.us-east-1.amazonaws.com", scope: "Read impacted service · current route · health" },
  { name: "Cloudflare MCP", region: "edge", url: "https://cf-mcp.edge.cloudflare.com/v1", scope: "Move traffic · verify health checks" },
  { name: "Snowflake MCP", region: "account", url: "https://sf-mcp.snowflakecomputing.com/api", scope: "List users · rotate creds · enforce MFA" },
];

function McpRow({ m, open, onToggle }: { m: Mcp; open: boolean; onToggle: () => void }) {
  return (
    <div className={"mcprow panel" + (open ? " mcprow--open" : "")}>
      <button className="mcprow__head" onClick={onToggle}>
        <span className="livedot" style={{ width: 8, height: 8 }} />
        <b>{m.name}</b>
        <span className="pill mono" style={{ fontSize: 10.5, padding: "3px 8px" }}>
          {m.region}
        </span>
        <span className="mcprow__state fine">connected</span>
        <Icon name="chevron" size={16} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </button>
      {open && (
        <div className="mcprow__body">
          <div className="mcprow__link mono">
            <Icon name="link" size={13} /> {m.url}
          </div>
          <div className="fine" style={{ marginTop: 8 }}>
            SCOPE · {m.scope}
          </div>
        </div>
      )}
    </div>
  );
}

export function McpServers() {
  const [open, setOpen] = useState(0);
  return (
    <section className="section">
      <div className="wrap mcp">
        <div className="mcp__copy reveal">
          <span className="eyebrow">
            <span className="dot" /> Vendor MCP servers
          </span>
          <h2 className="display display--lg" style={{ marginTop: 16 }}>
            Not just watching.
            <br />
            Wired to act.
          </h2>
          <p className="lede" style={{ marginTop: 16 }}>
            Each vendor exposes an MCP server Pulse can read, and when evidence is verified high-severity,
            act through. Connections are scoped, server-side, and logged.
          </p>
          <p className="fine" style={{ marginTop: 18 }}>
            Click a connection to inspect its endpoint and scope.
          </p>
        </div>
        <div className="mcp__list reveal">
          {MCP.map((m, i) => (
            <McpRow key={m.name} m={m} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
          ))}
        </div>
      </div>
    </section>
  );
}
