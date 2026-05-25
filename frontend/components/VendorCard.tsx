import { CalendarBlank, Database, Pulse } from "@phosphor-icons/react";
import { Badge } from "@/components/Badge";
import { formatDate, labelize } from "@/lib/formatters";
import type { Alert, Company } from "@/lib/types";

export function VendorCard({
  company,
  alerts,
  selected,
  onSelect,
}: {
  company: Company;
  alerts: Alert[];
  selected: boolean;
  onSelect: () => void;
}) {
  const topAlert = alerts.find((alert) => alert.company_id === company.id);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group w-full rounded-lg border bg-white p-4 text-left shadow-soft transition duration-300 active:scale-[0.99] ${
        selected
          ? "border-ink-900 ring-2 ring-ink-900/5"
          : "border-zinc-200 hover:border-zinc-300"
      }`}
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
        <Badge tone={company.criticality === "critical" ? "warn" : "neutral"}>
          {company.criticality}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-zinc-500">Owner</p>
          <p className="mt-1 font-medium text-ink-900">{company.owner}</p>
        </div>
        <div>
          <p className="text-zinc-500">Alert score</p>
          <p className="mt-1 font-mono font-semibold text-ink-900">
            {topAlert ? topAlert.score : "n/a"}
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
            {topAlert.score} score
          </span>
        ) : (
          <span className="text-xs text-zinc-400">No verified alert</span>
        )}
      </div>
    </button>
  );
}
