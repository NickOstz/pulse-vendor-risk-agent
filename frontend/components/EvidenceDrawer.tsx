"use client";

import { ArrowSquareOut, Rows, X } from "@phosphor-icons/react";
import { Badge, SourceModeBadge, SupportBadge } from "@/components/Badge";
import { QuoteVerificationView } from "@/components/QuoteVerificationView";
import { ScoreTooltip } from "@/components/ScoreTooltip";
import { formatDateTime, formatPercent, labelize } from "@/lib/formatters";
import type { Alert, BrightDataTrace, EvidenceItem } from "@/lib/types";

export function EvidenceDrawer({
  open,
  alerts,
  evidence,
  traces,
  selectedEvidenceId,
  onSelectEvidence,
  onClose,
}: {
  open: boolean;
  alerts: Alert[];
  evidence: EvidenceItem[];
  traces: BrightDataTrace[];
  selectedEvidenceId: string | null;
  onSelectEvidence: (id: string) => void;
  onClose: () => void;
}) {
  const selectedEvidence =
    evidence.find((item) => item.id === selectedEvidenceId) ?? evidence[0] ?? null;
  const selectedAlert =
    alerts.find((alert) => alert.evidence_item_id === selectedEvidence?.id) ??
    alerts[0];

  if (!open) return null;

  return (
    <aside className="fixed inset-y-0 right-0 z-30 flex w-full max-w-5xl border-l border-zinc-200 bg-white shadow-soft md:w-[86vw]">
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 px-5 py-4 backdrop-blur">
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

        <div className="grid gap-4 p-5 lg:grid-cols-[0.85fr_1.15fr]">
          <section className="space-y-3">
            {evidence.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectEvidence(item.id)}
                className={`w-full rounded-lg border bg-white p-4 text-left transition active:scale-[0.99] ${
                  item.id === selectedEvidence?.id
                    ? "border-ink-900"
                    : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <SupportBadge status={item.support_status} />
                  <Badge tone={item.severity_hint === "high" ? "warn" : "neutral"}>
                    {item.signal_type}
                  </Badge>
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
          </section>

          <div className="space-y-4">
            {selectedEvidence ? (
              <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-soft">
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
                  <Detail
                    label="Severity"
                    value={labelize(selectedEvidence.severity_hint)}
                  />
                  <Detail
                    label="Published"
                    value={formatDateTime(selectedEvidence.published_or_captured_at)}
                  />
                </dl>
              </section>
            ) : null}

            <QuoteVerificationView evidence={selectedEvidence} />

            <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-ink-950">
                  Bright Data trace rows
                </h3>
                <Badge tone="warn">Fallback visible</Badge>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="border-b border-zinc-200 text-zinc-500">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Product</th>
                      <th className="py-2 pr-4 font-medium">Operation</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Mode</th>
                      <th className="py-2 pr-4 font-medium">Latency</th>
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
                        <td className="py-3 pr-4 text-zinc-600">
                          {formatDateTime(trace.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </div>
    </aside>
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
