import { CalendarBlank, Database, Pulse, Trash } from "@phosphor-icons/react";
import { formatDate, labelize } from "@/lib/formatters";
import type { Alert, Company } from "@/lib/types";

export function VendorCard({
  company,
  alerts,
  hasNewFinding,
  findingCount,
  selected,
  onSelect,
  onDelete,
  deleteDisabled = false,
}: {
  company: Company;
  alerts: Alert[];
  hasNewFinding: boolean;
  findingCount: number;
  selected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  deleteDisabled?: boolean;
}) {
  const topAlert = alerts.find((alert) => alert.company_id === company.id);
  const alertState = getVendorAlertState(company, hasNewFinding, findingCount);

  return (
    <article
      className={`group relative rounded-lg border bg-white shadow-soft transition duration-300 ${
        selected
          ? "border-ink-900 ring-2 ring-ink-900/5"
          : "border-zinc-200 hover:border-zinc-300"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full p-4 pr-12 text-left active:scale-[0.99]"
      >
        <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Database size={17} weight="duotone" className="text-signal-700" />
            <h3 className="truncate text-sm font-semibold text-ink-950">
              {company.name}
            </h3>
          </div>
          <p className="mt-1 truncate font-mono text-xs text-zinc-500">
            {company.domain}
          </p>
        </div>
        <span
          className={`inline-flex min-h-7 items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${alertState.className}`}
          title={alertState.title}
        >
          {alertState.label}
        </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-zinc-500">Owner</p>
          <p className="mt-1 font-medium text-ink-900">{company.owner}</p>
        </div>
        <div>
          <p className="text-zinc-500">Alert score</p>
          <p className="mt-1 font-mono font-semibold text-ink-900">
            {topAlert ? topAlert.score : "no new"}
          </p>
        </div>
        <div className="col-span-2 flex items-center gap-2 border-t border-zinc-100 pt-3">
          <CalendarBlank size={15} className="text-zinc-500" />
          <span className="text-zinc-600">Renewal {formatDate(company.renewal_date)}</span>
        </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-zinc-100 pt-3">
        <span className="inline-flex items-center gap-2 text-xs text-zinc-600">
          <Pulse
            size={14}
            weight={company.agent_enabled ? "fill" : "regular"}
            className={company.agent_enabled ? "text-signal-600" : "text-zinc-400"}
          />
          {labelize(company.agent_status)}
        </span>
        {topAlert ? (
          <span className="truncate text-right text-xs font-medium text-ink-900">
            {hasNewFinding ? "New finding" : "Reviewed"}
          </span>
        ) : (
          <span className="text-xs text-zinc-400">No alert</span>
        )}
        </div>
      </button>
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleteDisabled}
          title={deleteDisabled ? "Operator token required" : `Delete ${company.name}`}
          aria-label={`Delete ${company.name}`}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 transition hover:border-rose-100 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash size={15} weight="bold" />
        </button>
      ) : null}
    </article>
  );
}

function getVendorAlertState(
  company: Company,
  hasNewFinding: boolean,
  findingCount: number,
) {
  if (hasNewFinding) {
    return {
      label: findingCount > 1 ? `${findingCount} new` : "New alert",
      title: `Pulse found new verified evidence for ${company.name}.`,
      className: "border-rose-300 bg-rose-100 text-rose-800",
    };
  }

  if (company.agent_status === "running") {
    return {
      label: "Scanning",
      title: `${company.name} is currently being reviewed.`,
      className: "border-signal-100 bg-signal-50 text-signal-700",
    };
  }

  return {
    label: "No alert",
    title: `${company.name} has no unread finding.`,
    className: "border-zinc-200 bg-white text-zinc-600",
  };
}
