"use client";

import { Fragment, useState } from "react";
import { Icon, Sparkle } from "./icons";

type Case = {
  id: string;
  tab: string;
  vendor: string;
  signalType: string;
  source: string;
  action: string;
  title: string;
  status: string;
  desc: string;
  pathLabel: string;
  path: string[];
  mcps: string[];
  log: string[];
  result: string;
};

const CASES: Case[] = [
  {
    id: "migrate",
    tab: "Outage → migrate",
    vendor: "AWS",
    signalType: "Operational / adverse media",
    source: "bbc.com/news/articles/cev1en9077ro",
    action: "Pulse moved affected traffic from AWS to Cloudflare and verified the issue is resolved.",
    title: "Autonomous outage migration completed",
    status: "ISSUE RESOLVED",
    desc: "High-severity outage evidence triggered autonomous work. Pulse alerted the owner, used the vendor MCP servers, moved the affected service to a healthy provider, and confirmed the issue is resolved.",
    pathLabel: "Service migration path",
    path: ["AWS", "Cloudflare"],
    mcps: ["AWS MCP · aws-mcp.us-east-1.api.aws/mcp", "Cloudflare MCP · mcp.cloudflare.com/mcp"],
    log: [
      "Alerted IT owner that verified AWS outage evidence was high severity.",
      "Connected to AWS MCP to read the impacted service and current route.",
      "Connected to Cloudflare MCP and moved the affected traffic to the healthy path.",
      "Verified Cloudflare health checks and marked the issue resolved.",
    ],
    result: "Cloudflare is now serving the protected workload; AWS remains monitored until recovery stabilizes.",
  },
  {
    id: "contain",
    tab: "Breach → contain (Snowflake)",
    vendor: "Snowflake",
    signalType: "Operational / adverse media",
    source: "nightfall.ai/blog/what-happened-in-the-snowflake-data-breach",
    action: "Pulse enforced Snowflake MFA, rotated exposed credentials, narrowed network access, and opened an exfiltration review.",
    title: "Autonomous data-breach containment completed",
    status: "RISK CONTAINED",
    desc: "High-severity breach evidence triggered autonomous containment. Pulse alerted the Data owner, used the Snowflake MCP server, tightened account access, and confirmed the tenant is in a safer review state.",
    pathLabel: "Containment path",
    path: ["Snowflake", "MFA enforced", "Access narrowed"],
    mcps: ["Snowflake MCP · account-scoped endpoint"],
    log: [
      "Alerted Data owner that verified Snowflake breach evidence was high severity.",
      "Connected to Snowflake MCP to list users, service accounts, sessions, and recent query activity.",
      "Rotated exposed passwords and API secrets, revoked active sessions, and enforced MFA on every interactive account.",
      "Applied trusted network rules and flagged unusual data-export queries for follow-up review.",
    ],
    result: "Snowflake access is locked behind MFA and trusted network rules; exposed credentials were rotated and query history remains under review.",
  },
  {
    id: "secrets",
    tab: "Breach → contain (Vercel)",
    vendor: "Vercel",
    signalType: "Operational / adverse media",
    source: "vercel.com/kb/bulletin/vercel-april-2026-security-incident",
    action: "Pulse rotated exposed Vercel environment secrets, revoked risky OAuth grants, and verified clean redeployments.",
    title: "Autonomous secret-containment completed",
    status: "RISK CONTAINED",
    desc: "High-severity breach evidence triggered autonomous containment. Pulse alerted Engineering, used the Vercel MCP server, protected exposed deployment secrets, and confirmed the project is in a safer review state.",
    pathLabel: "Secret containment path",
    path: ["Vercel", "Secrets rotated", "Deployments verified"],
    mcps: ["Vercel MCP · mcp.vercel.com"],
    log: [
      "Alerted Engineering that verified Vercel breach evidence was high severity.",
      "Connected to Vercel MCP to inventory projects, environment variables, OAuth integrations, and recent deployments.",
      "Rotated API keys, database URLs, webhook secrets, and tokens stored in exposed environment variables.",
      "Marked secrets as sensitive, revoked risky OAuth grants, redeployed affected projects, and checked logs for unexpected changes.",
    ],
    result: "Vercel projects are using rotated sensitive variables; risky OAuth access was revoked and recent deployments were checked for unexpected changes.",
  },
];

export function AgentWork() {
  const [active, setActive] = useState(0);
  const c = CASES[active];
  return (
    <section id="agent" className="section">
      <div className="halo" style={{ width: 520, height: 520, top: 40, left: -260, opacity: 0.18 }} />
      <div className="wrap" style={{ position: "relative", zIndex: 1 }}>
        <div className="shead reveal">
          <span className="eyebrow eyebrow--accent">
            <Sparkle size={13} /> The agent doesn&apos;t just alert
          </span>
          <h2 className="display display--xl">
            It investigates, decides,
            <br />
            and <span className="grad-text">does the work</span>.
          </h2>
          <p className="lede">
            When a verified signal crosses high severity, Pulse runs the matching playbook through the
            vendor&apos;s MCP servers, then shows you every step it took.
          </p>
        </div>

        <div className="awtabs reveal">
          {CASES.map((cc, i) => (
            <button
              key={cc.id}
              className={"awtab" + (i === active ? " awtab--on" : "")}
              onClick={() => setActive(i)}
            >
              <Icon name={cc.id === "migrate" ? "swap" : "lock"} size={16} />
              {cc.tab}
            </button>
          ))}
        </div>

        <div className="aw">
          {/* signal banner */}
          <div className="signal">
            <div className="signal__l">
              <div className="fine" style={{ color: "rgba(255,255,255,0.6)" }}>
                SIGNAL
              </div>
              <b className="signal__type">{c.signalType}</b>
              <div className="signal__src">
                <span className="fine" style={{ color: "rgba(255,255,255,0.6)" }}>
                  SOURCE
                </span>
                <a className="mono" href={"https://" + c.source} target="_blank" rel="noreferrer">
                  {c.source}
                </a>
              </div>
            </div>
            <div className="signal__r">
              <div className="signal__badges">
                <span className="badge badge--solid-high">HIGH</span>
                <span className="badge" style={{ color: "#fff" }}>
                  LIVE
                </span>
                <span className="badge" style={{ color: "#fff" }}>
                  VERIFIED
                </span>
              </div>
              <div className="signal__action">
                <span className="fine" style={{ color: "rgba(255,255,255,0.6)" }}>
                  PULSE ACTION
                </span>
                <p>{c.action}</p>
              </div>
            </div>
          </div>

          {/* agent work card */}
          <div className="awcard panel">
            <div className="awcard__head">
              <div className="awcard__title">
                <span className="awcard__zap">
                  <Icon name="zap" size={18} />
                </span>
                <div>
                  <div className="eyebrow eyebrow--accent">Pulse AI agent work</div>
                  <b className="display display--md" style={{ fontSize: 21 }}>
                    {c.title}
                  </b>
                </div>
              </div>
              <span className="badge badge--live" style={{ borderColor: "var(--ok)" }}>
                <Icon name="checkCircle" size={12} /> {c.status}
              </span>
            </div>
            <p className="awcard__desc">{c.desc}</p>

            <div className="awcard__inner">
              <div className="fine" style={{ marginBottom: 12 }}>
                {c.pathLabel.toUpperCase()}
              </div>
              <div className="awpath">
                {c.path.map((p, i) => (
                  <Fragment key={p}>
                    <span className="awpath__node">{p}</span>
                    {i < c.path.length - 1 && (
                      <Icon name="refresh" size={16} style={{ color: "var(--accent)" }} />
                    )}
                  </Fragment>
                ))}
              </div>
              <div className="awmcps">
                {c.mcps.map((m) => (
                  <div key={m} className="awmcp">
                    <span className="livedot" style={{ width: 7, height: 7 }} /> {m}{" "}
                    <Icon name="chevron" size={13} style={{ marginLeft: "auto", color: "var(--fg-faint)" }} />
                  </div>
                ))}
              </div>

              <div className="fine" style={{ margin: "22px 0 12px" }}>
                EXECUTION LOG
              </div>
              <div className="awlog">
                {c.log.map((l, i) => (
                  <div key={i} className="awlog__step">
                    <span className="awlog__n">{i + 1}</span>
                    <p>{l}</p>
                  </div>
                ))}
              </div>

              <div className="awresult">
                <Icon name="shield" size={16} />
                <p>{c.result}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
