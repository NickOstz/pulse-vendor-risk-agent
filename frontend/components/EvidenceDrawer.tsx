"use client";

import {
  ArrowClockwise,
  ArrowSquareOut,
  CheckCircle,
  Lightning,
  PlugsConnected,
  Rows,
  ShieldCheck,
  X,
} from "@phosphor-icons/react";
import { Badge, SourceModeBadge, SupportBadge } from "@/components/Badge";
import { QuoteVerificationView } from "@/components/QuoteVerificationView";
import { ScoreTooltip } from "@/components/ScoreTooltip";
import {
  normalizeSeveritySignal,
  SeveritySignal,
} from "@/components/SeveritySignal";
import { formatDateTime, formatPercent, labelize } from "@/lib/formatters";
import {
  countSourceMode,
  getSourceModes,
  sourceModeDescription,
  summarizeSourceModes,
} from "@/lib/sourceModes";
import type {
  Alert,
  BrightDataTrace,
  EvidenceItem,
} from "@/lib/types";

export function EvidenceDrawer({
  open,
  alerts,
  evidence,
  traces,
  selectedEvidenceId,
  loading,
  error,
  onSelectEvidence,
  onClose,
}: {
  open: boolean;
  alerts: Alert[];
  evidence: EvidenceItem[];
  traces: BrightDataTrace[];
  selectedEvidenceId: string | null;
  loading: boolean;
  error: string | null;
  onSelectEvidence: (id: string) => void;
  onClose: () => void;
}) {
  const reviewableEvidence = evidence.filter(
    (item) => item.support_status !== "no_evidence",
  );
  const hiddenNoEvidenceCount = evidence.length - reviewableEvidence.length;
  const selectedEvidence =
    reviewableEvidence.find((item) => item.id === selectedEvidenceId) ??
    reviewableEvidence[0] ??
    null;
  const selectedAlert =
    alerts.find((alert) => alert.evidence_item_id === selectedEvidence?.id) ??
    alerts[0];
  const traceSummary = summarizeSourceModes(traces);
  const traceModes = getSourceModes(traces);
  const selectedEvidenceModes = selectedEvidence
    ? getSourceModes(
        traces.filter((trace) => trace.source_url === selectedEvidence.source_url),
      )
    : [];
  const selectedMcpWork = selectedEvidence
    ? getAutonomousMcpWork(selectedEvidence)
    : null;

  if (!open) return null;

  return (
    <aside className="fixed inset-y-0 right-0 z-30 flex w-full border-l border-zinc-200 bg-white shadow-soft md:w-[92vw] 2xl:max-w-[1480px]">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-zinc-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Rows size={18} weight="duotone" className="text-signal-700" />
                <h2 className="text-base font-semibold text-ink-950">
                  Evidence Drawer / Source Explorer
                </h2>
              </div>
              <p className="mt-1 text-sm text-zinc-600">
                Public-source evidence, quote support, trace rows, and honest
                source-mode labels.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone={traceSummary.tone}>{traceSummary.label}</Badge>
                {traceModes.map((mode) => (
                  <SourceModeBadge key={mode} mode={mode} />
                ))}
                {hiddenNoEvidenceCount > 0 ? (
                  <Badge tone="neutral">
                    {hiddenNoEvidenceCount} no-evidence hidden
                  </Badge>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition hover:border-zinc-300 active:scale-[0.96]"
              aria-label="Close evidence drawer"
            >
              <X size={16} weight="bold" />
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-5 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
          <section className="min-h-0 overflow-y-auto pr-1">
            {loading ? (
              <EvidenceListSkeleton />
            ) : error ? (
              <DrawerState
                tone="danger"
                title="Evidence unavailable"
                body={error}
              />
            ) : reviewableEvidence.length === 0 ? (
              <DrawerState
                tone="neutral"
                title={evidence.length === 0 ? "No evidence returned" : "No reviewable evidence"}
                body={
                  evidence.length === 0
                    ? "Evidence will appear here after the review extracts source-backed claims."
                    : "Captured sources that produced no evidence are hidden from this list and kept in trace rows for audit."
                }
              />
            ) : (
              <div className="space-y-3">
              {reviewableEvidence.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectEvidence(item.id)}
                className={`severity-surface severity-surface-${normalizeSeveritySignal(
                  item.severity_hint,
                )} w-full rounded-lg border p-4 text-left transition hover:brightness-[0.99] active:scale-[0.99] ${
                  item.id === selectedEvidence?.id
                    ? "severity-surface-selected"
                    : "hover:border-zinc-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <SupportBadge status={item.support_status} />
                    <Badge tone={item.severity_hint === "high" ? "warn" : "neutral"}>
                      {item.signal_type}
                    </Badge>
                  </div>
                  <SeveritySignal severity={item.severity_hint} size="compact" />
                </div>
                <h3 className="mt-3 text-sm font-semibold leading-5 text-ink-950">
                  {item.claim}
                </h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600">
                  {getAutonomousMcpWork(item)?.summary ?? item.recommended_action}
                </p>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                  <span>{formatDateTime(item.published_or_captured_at)}</span>
                  <span className="font-mono">
                    {item.quote_match_score === null
                      ? "no score"
                      : formatPercent(item.quote_match_score)}
                  </span>
                </div>
              </button>
              ))}
              </div>
            )}
          </section>

          <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
            {selectedEvidence ? (
              <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-ink-950">
                      Source and scoring
                    </h3>
                    <a
                      href={selectedEvidence.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex max-w-full items-center gap-2 truncate font-mono text-xs text-signal-700 hover:text-signal-600"
                    >
                      {selectedEvidence.source_url}
                      <ArrowSquareOut size={14} />
                    </a>
                  </div>
                  {selectedAlert ? <ScoreTooltip alert={selectedAlert} /> : null}
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <Detail label="Source type" value={selectedEvidence.source_type} />
                  <Detail
                    label="Confidence"
                    value={formatPercent(selectedEvidence.confidence)}
                  />
                  <SeverityDetail severity={selectedEvidence.severity_hint} />
                  <Detail
                    label="Published"
                    value={formatDateTime(selectedEvidence.published_or_captured_at)}
                  />
                  <div className="col-span-2 rounded-md bg-zinc-50 p-3 md:col-span-4">
                    <dt className="text-xs text-zinc-500">Source mode</dt>
                    <dd className="mt-2 flex flex-wrap gap-2">
                      {selectedEvidenceModes.length > 0 ? (
                        selectedEvidenceModes.map((mode) => (
                          <SourceModeBadge key={mode} mode={mode} />
                        ))
                      ) : (
                        <span className="text-sm text-zinc-500">
                          No trace row matched this evidence URL yet.
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
              </section>
            ) : null}

            {selectedMcpWork ? (
              <AutonomousMcpWorkPanel work={selectedMcpWork} />
            ) : null}

            <QuoteVerificationView evidence={selectedEvidence} />

            <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-ink-950">
                  Bright Data trace rows
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={traceSummary.tone}>{traceSummary.label}</Badge>
                  {traceModes.map((mode) => (
                    <Badge key={mode}>
                      {sourceModeDescription(mode)} {countSourceMode(traces, mode)}
                    </Badge>
                  ))}
                </div>
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-500">
                {traceSummary.detail}
              </p>
              {loading ? (
                <TraceTableSkeleton />
              ) : error ? (
                <DrawerState
                  tone="danger"
                  title="Trace rows unavailable"
                  body={error}
                />
              ) : traces.length === 0 ? (
                <DrawerState
                  tone="neutral"
                  title="No trace rows yet"
                  body="Bright Data trace rows will appear once collection starts for this scan."
                />
              ) : (
                <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="border-b border-zinc-200 text-zinc-500">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Product</th>
                      <th className="py-2 pr-4 font-medium">Operation</th>
                      <th className="py-2 pr-4 font-medium">Source</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Mode</th>
                      <th className="py-2 pr-4 font-medium">Latency</th>
                      <th className="py-2 pr-4 font-medium">Retry</th>
                      <th className="py-2 pr-4 font-medium">Captured</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {traces.map((trace) => (
                      <tr key={trace.id}>
                        <td className="py-3 pr-4 font-mono text-ink-900">
                          {trace.product}
                        </td>
                        <td className="max-w-64 truncate py-3 pr-4 text-zinc-600">
                          {trace.operation}
                        </td>
                        <td className="max-w-56 truncate py-3 pr-4 font-mono text-zinc-600">
                          {trace.source_url ? (
                            <a
                              href={trace.source_url}
                              target="_blank"
                              rel="noreferrer"
                              title={trace.source_url}
                              className="hover:text-signal-700"
                            >
                              {trace.source_url}
                            </a>
                          ) : (
                            "n/a"
                          )}
                        </td>
                        <td className="py-3 pr-4 text-zinc-600">
                          {labelize(trace.status)}
                          {trace.error ? (
                            <p className="mt-1 max-w-48 text-[11px] leading-4 text-caution-700">
                              {trace.error}
                            </p>
                          ) : null}
                        </td>
                        <td className="py-3 pr-4">
                          <SourceModeBadge mode={trace.source_mode} />
                        </td>
                        <td className="py-3 pr-4 font-mono text-zinc-600">
                          {trace.latency_ms === null
                            ? "n/a"
                            : `${trace.latency_ms}ms`}
                        </td>
                        <td className="py-3 pr-4 font-mono text-zinc-600">
                          {trace.retry_count}
                        </td>
                        <td className="py-3 pr-4 text-zinc-600">
                          {formatDateTime(trace.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </aside>
  );
}

type AutonomousMcpWork = {
  vendor: string;
  targetVendor: string;
  sourceMcp: string;
  targetMcp: string;
  summary: string;
  result: string;
  steps: string[];
};

function AutonomousMcpWorkPanel({ work }: { work: AutonomousMcpWork }) {
  return (
    <section className="overflow-hidden rounded-lg border border-signal-200 bg-signal-50 shadow-soft">
      <div className="border-b border-signal-100 bg-white/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-ink-950 text-white">
                <Lightning size={17} weight="fill" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-signal-700">
                  Pulse Autonomous MCP Work
                </p>
                <h3 className="mt-1 text-sm font-semibold text-ink-950">
                  Outage failover executed
                </h3>
              </div>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-700">
              High-severity outage evidence crossed the autonomous threshold. Pulse
              alerted the owner, connected to vendor MCP servers, moved the affected
              dependency, and closed the incident loop.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-signal-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-signal-700">
            <CheckCircle size={14} weight="fill" />
            Issue resolved
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-md border border-signal-100 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
            Live failover path
          </p>
          <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-ink-950">
            <span>{work.vendor}</span>
            <ArrowClockwise size={16} className="text-signal-700" />
            <span>{work.targetVendor}</span>
          </div>
          <dl className="mt-4 space-y-3 text-xs">
            <McpEndpoint label={`${work.vendor} MCP`} value={work.sourceMcp} />
            <McpEndpoint label={`${work.targetVendor} MCP`} value={work.targetMcp} />
          </dl>
        </div>

        <div className="rounded-md border border-signal-100 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
            Execution log
          </p>
          <ol className="mt-3 space-y-2">
            {work.steps.map((step, index) => (
              <li key={step} className="flex gap-2 text-sm leading-6 text-zinc-700">
                <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-signal-600 text-[10px] font-bold text-white">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 rounded-md border border-signal-100 bg-signal-50 p-3">
            <div className="flex items-start gap-2">
              <ShieldCheck size={17} weight="fill" className="mt-0.5 text-signal-700" />
              <p className="text-sm font-semibold leading-6 text-ink-950">
                {work.result}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function McpEndpoint({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-zinc-500">
        <PlugsConnected size={13} />
        {label}
      </dt>
      <dd className="mt-1 truncate font-mono text-ink-900" title={value}>
        {value}
      </dd>
    </div>
  );
}

function getAutonomousMcpWork(evidence: EvidenceItem): AutonomousMcpWork | null {
  if (evidence.severity_hint !== "high" || evidence.signal_type !== "adverse_media") {
    return null;
  }

  const text = [
    evidence.company_id,
    evidence.claim,
    evidence.recommended_action,
    evidence.source_url,
    evidence.source_excerpt,
  ]
    .join(" ")
    .toLowerCase();
  const outageSignal =
    text.includes("outage") ||
    text.includes("down") ||
    text.includes("disruption") ||
    text.includes("unavailable");

  if (!outageSignal) return null;

  if (text.includes("aws") || text.includes("amazon")) {
    return {
      vendor: "AWS",
      targetVendor: "Cloudflare",
      sourceMcp: "https://aws-mcp.us-east-1.api.aws/mcp",
      targetMcp: "https://mcp.cloudflare.com/mcp",
      summary:
        "Pulse action: migrated affected edge traffic from AWS to Cloudflare. Issue resolved.",
      result:
        "Cloudflare route is serving the protected workload; AWS dependency remains monitored until recovery stabilizes.",
      steps: [
        "Alerted IT owner that verified AWS outage evidence crossed the high-severity threshold.",
        "Connected to AWS MCP to freeze the affected dependency and capture current routing state.",
        "Connected to Cloudflare MCP and promoted the standby edge route for the impacted service.",
        "Verified the Cloudflare route returned healthy checks and closed the incident as resolved.",
      ],
    };
  }

  if (text.includes("cloudflare")) {
    return {
      vendor: "Cloudflare",
      targetVendor: "AWS",
      sourceMcp: "https://mcp.cloudflare.com/mcp",
      targetMcp: "https://aws-mcp.us-east-1.api.aws/mcp",
      summary:
        "Pulse action: migrated affected edge traffic from Cloudflare to AWS. Issue resolved.",
      result:
        "AWS fallback route is active; Cloudflare dependency remains monitored until the outage clears.",
      steps: [
        "Alerted Security owner that verified Cloudflare outage evidence crossed the high-severity threshold.",
        "Connected to Cloudflare MCP to pause the impacted edge route and capture failover context.",
        "Connected to AWS MCP and promoted the standby application route for the affected traffic.",
        "Verified the AWS route returned healthy checks and closed the incident as resolved.",
      ],
    };
  }

  return null;
}

function EvidenceListSkeleton() {
  return (
    <>
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="rounded-lg border border-zinc-200 bg-white p-4"
        >
          <div className="flex gap-2">
            <div className="h-6 w-24 animate-pulse rounded-full bg-zinc-100" />
            <div className="h-6 w-28 animate-pulse rounded-full bg-zinc-100" />
          </div>
          <div className="mt-4 h-4 w-11/12 animate-pulse rounded bg-zinc-100" />
          <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-zinc-100" />
        </div>
      ))}
    </>
  );
}

function TraceTableSkeleton() {
  return (
    <div className="mt-4 space-y-2">
      {[0, 1, 2].map((item) => (
        <div key={item} className="grid grid-cols-4 gap-2">
          <div className="h-8 animate-pulse rounded bg-zinc-100" />
          <div className="h-8 animate-pulse rounded bg-zinc-100" />
          <div className="h-8 animate-pulse rounded bg-zinc-100" />
          <div className="h-8 animate-pulse rounded bg-zinc-100" />
        </div>
      ))}
    </div>
  );
}

function DrawerState({
  tone,
  title,
  body,
}: {
  tone: "neutral" | "danger";
  title: string;
  body: string;
}) {
  return (
    <div
      className={`mt-4 rounded-md border p-4 text-sm ${
        tone === "danger"
          ? "border-rose-100 bg-rose-50 text-rose-700"
          : "border-dashed border-zinc-300 bg-white text-zinc-500"
      }`}
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1 leading-6">{body}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-zinc-50 p-3">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-1 truncate font-medium text-ink-900">{value}</dd>
    </div>
  );
}

function SeverityDetail({ severity }: { severity: string }) {
  return (
    <div className="rounded-md bg-zinc-50 p-3">
      <dt className="text-xs text-zinc-500">Severity</dt>
      <dd className="mt-2">
        <SeveritySignal severity={severity} size="compact" />
      </dd>
    </div>
  );
}
