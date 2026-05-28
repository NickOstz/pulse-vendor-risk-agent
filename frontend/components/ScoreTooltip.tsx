import { Info } from "@phosphor-icons/react";
import type { Alert } from "@/lib/types";

export function ScoreTooltip({ alert }: { alert: Alert }) {
  const factors = alert.score_factors;

  return (
    <div className="group relative inline-flex">
      <button
        type="button"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition hover:border-zinc-300 active:scale-[0.96]"
        aria-label="Show deterministic score explanation"
      >
        <Info size={15} weight="bold" />
      </button>
      <div className="pointer-events-none absolute right-0 top-9 z-20 hidden w-72 rounded-lg border border-zinc-200 bg-white p-3 text-left text-xs shadow-soft group-hover:block">
        <p className="font-semibold text-ink-950">Deterministic score</p>
        <p className="mt-1 leading-5 text-zinc-600">
          The LLM does not set this score. Verified evidence uses severity,
          source reliability, confidence, freshness, and vendor context.
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px] text-zinc-600">
          {Object.entries(factors).map(([key, value]) => (
            <div key={key} className="rounded-md bg-zinc-50 p-2">
              <dt className="truncate text-zinc-400">{key}</dt>
              <dd className="mt-1 truncate text-ink-900">{String(value)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
