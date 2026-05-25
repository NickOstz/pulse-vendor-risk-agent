import { labelize, sourceModeTone, supportTone } from "@/lib/formatters";
import type { SourceMode, SupportStatus } from "@/lib/types";

type BadgeTone = "neutral" | "good" | "warn" | "danger";

const toneClassName: Record<BadgeTone, string> = {
  neutral: "border-zinc-200 bg-white text-zinc-600",
  good: "border-signal-100 bg-signal-50 text-signal-700",
  warn: "border-caution-100 bg-caution-50 text-caution-700",
  danger: "border-rose-100 bg-rose-50 text-rose-700",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${toneClassName[tone]}`}
    >
      {children}
    </span>
  );
}

export function SupportBadge({ status }: { status: SupportStatus }) {
  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${supportTone(status)}`}
    >
      {labelize(status)}
    </span>
  );
}

export function SourceModeBadge({ mode }: { mode: SourceMode }) {
  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${sourceModeTone(mode)}`}
    >
      {mode}
    </span>
  );
}
