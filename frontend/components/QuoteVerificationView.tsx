import { MagnifyingGlass } from "@phosphor-icons/react";
import { SupportBadge } from "@/components/Badge";
import { formatPercent } from "@/lib/formatters";
import type { EvidenceItem } from "@/lib/types";

export function QuoteVerificationView({
  evidence,
}: {
  evidence: EvidenceItem | null;
}) {
  if (!evidence) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
        Select an evidence item to inspect quote verification.
      </div>
    );
  }

  const parts = splitExcerpt(evidence.source_excerpt, evidence.supporting_quote);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <MagnifyingGlass size={17} className="text-signal-700" />
            <h2 className="text-sm font-semibold text-ink-950">
              Quote Verification
            </h2>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Side-by-side extracted quote and captured source context.
          </p>
        </div>
        <SupportBadge status={evidence.support_status} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
            Extracted quote
          </p>
          <blockquote className="mt-3 text-sm leading-6 text-ink-900">
            {evidence.supporting_quote}
          </blockquote>
          <p className="mt-3 font-mono text-xs text-zinc-500">
            Match score{" "}
            {evidence.quote_match_score === null
              ? "not available"
              : formatPercent(evidence.quote_match_score)}
          </p>
        </div>

        <div className="rounded-md border border-zinc-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
            Source excerpt
          </p>
          <p className="mt-3 text-sm leading-6 text-ink-900">
            {parts ? (
              <>
                {parts.before}
                <mark className="rounded bg-caution-100 px-1 py-0.5 text-ink-950">
                  {parts.match}
                </mark>
                {parts.after}
              </>
            ) : (
              evidence.source_excerpt
            )}
          </p>
        </div>
      </div>
    </section>
  );
}

function splitExcerpt(excerpt: string, quote: string) {
  const index = excerpt.toLowerCase().indexOf(quote.toLowerCase());
  if (index === -1) return null;

  return {
    before: excerpt.slice(0, index),
    match: excerpt.slice(index, index + quote.length),
    after: excerpt.slice(index + quote.length),
  };
}
