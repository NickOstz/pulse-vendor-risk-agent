import type { SourceMode, SupportStatus } from "@/lib/types";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value: string | null) {
  if (!value) return "Not available";
  return dateTimeFormatter.format(new Date(value));
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function labelize(value: string) {
  return value.replaceAll("_", " ");
}

export function supportTone(status: SupportStatus) {
  switch (status) {
    case "verified":
      return "border-signal-100 bg-signal-50 text-signal-700";
    case "needs_review":
      return "border-caution-100 bg-caution-50 text-caution-700";
    case "failed_source":
      return "border-rose-100 bg-rose-50 text-rose-700";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-600";
  }
}

export function sourceModeTone(mode: SourceMode) {
  switch (mode) {
    case "live":
      return "border-signal-100 bg-signal-50 text-signal-700";
    case "cached":
      return "border-zinc-200 bg-white text-zinc-600";
    case "fallback":
      return "border-caution-100 bg-caution-50 text-caution-700";
  }
}
