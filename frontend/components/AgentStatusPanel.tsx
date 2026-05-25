import { Clock, MapPinLine, Pulse, SealCheck } from "@phosphor-icons/react";
import { Badge } from "@/components/Badge";
import { formatDateTime, labelize } from "@/lib/formatters";
import { summarizeSourceModes } from "@/lib/sourceModes";
import type {
  AgentStatusResponse,
  BrightDataTrace,
  Company,
  ScanStatusResponse,
} from "@/lib/types";

export function AgentStatusPanel({
  company,
  agentStatus,
  scan,
  traces,
}: {
  company: Company;
  agentStatus: AgentStatusResponse | null;
  scan: ScanStatusResponse | null;
  traces: BrightDataTrace[];
}) {
  const sourceSummary = summarizeSourceModes(traces, scan?.mode);
  const currentActivity = scan
    ? scan.status === "completed_with_fallback"
      ? `Review complete: ${sourceSummary.label}`
      : scan.status === "completed"
        ? `Review complete: ${sourceSummary.label}`
        : scan.status === "failed"
          ? "Review failed, evidence preserved"
          : `Investigating public sources: ${labelize(scan.current_stage)}`
    : company.agent_enabled
      ? "Waiting for due vendor scheduler"
      : "Inactive";

  const activeRun = agentStatus?.active_runs.find(
    (run) => run.company_id === company.id,
  );
  const nextReviewLabel =
    company.agent_enabled && isDueNow(company.next_agent_run_at)
      ? "Due now"
      : formatDateTime(company.next_agent_run_at);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink-950">Agent Status</h2>
        <Badge tone={company.agent_enabled ? "good" : "neutral"}>
          {company.agent_enabled ? "autonomous" : "off"}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 text-sm">
        <StatusRow
          icon={<MapPinLine size={17} />}
          label="Review policy"
          value={
            company.review_policy
              ? labelize(company.review_policy)
              : "No active policy"
          }
        />
        <StatusRow
          icon={<Clock size={17} />}
          label="Next review"
          value={nextReviewLabel}
        />
        <StatusRow
          icon={<Pulse size={17} />}
          label="Current activity"
          value={currentActivity}
        />
        <StatusRow
          icon={<SealCheck size={17} />}
          label="Latest assessment"
          value={
            scan
              ? `${labelize(scan.status)} (${labelize(scan.mode)})`
              : activeRun
                ? `Running ${labelize(activeRun.current_stage)}`
                : labelize(company.agent_status)
          }
        />
      </div>
    </div>
  );
}

function isDueNow(value: string | null) {
  if (!value) return false;
  return new Date(value).getTime() <= Date.now();
}

function StatusRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-zinc-100 pt-3 first:border-t-0 first:pt-0">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="truncate font-medium text-ink-900">{value}</p>
      </div>
    </div>
  );
}
