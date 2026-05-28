"use client";

import {
  ArrowSquareOut,
  Rows,
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

  if (!open) return null;

  return (
    <aside className="fixed inset-y-0 right-0 z-30 flex w-full border-l border-zinc-200 bg-white shadow-soft lg:w-[92vw] 2xl:max-w-[1480px]">
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

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 sm:p-5 lg:overflow-hidden lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
          <section className="min-h-0 max-h-80 overflow-y-auto pr-1 lg:max-h-none">
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
                  {item.recommended_action}
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

          <div className="min-h-0 space-y-4 lg:overflow-y-auto lg:pr-1">
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

                <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
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
                  <div className="rounded-md bg-zinc-50 p-3 sm:col-span-2 xl:col-span-4">
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
