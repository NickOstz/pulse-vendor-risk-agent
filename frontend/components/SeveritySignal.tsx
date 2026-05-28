import { labelize } from "@/lib/formatters";

export type SeveritySignalLevel = "low" | "medium" | "high" | "unknown";

export function normalizeSeveritySignal(
  severity: string | null | undefined,
): SeveritySignalLevel {
  const normalized = (severity ?? "").toLowerCase();

  if (
    normalized === "low" ||
    normalized === "medium" ||
    normalized === "high"
  ) {
    return normalized;
  }

  return "unknown";
}

export function SeveritySignal({
  severity,
  size = "default",
  title = "Severity",
}: {
  severity: string | null | undefined;
  size?: "default" | "compact";
  title?: string;
}) {
  const normalized = normalizeSeveritySignal(severity);
  const label = normalized === "unknown" ? severity || "n/a" : labelize(normalized);

  return (
    <span
      className={`severity-signal severity-signal-${normalized} ${
        size === "compact" ? "severity-signal-compact" : ""
      }`}
      aria-label={`${title}: ${label}`}
      title={title}
    >
      <span className="severity-signal-label">{label}</span>
    </span>
  );
}
