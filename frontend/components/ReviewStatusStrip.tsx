import { Check, CircleDashed, WarningCircle } from "@phosphor-icons/react";
import { Badge, SourceModeBadge } from "@/components/Badge";
import { labelize } from "@/lib/formatters";
import {
  getSourceModes,
  scanStatusTone,
  summarizeSourceModes,
} from "@/lib/sourceModes";
import type { BrightDataTrace, ScanStatusResponse, StageStatus } from "@/lib/types";

const stageLabels = ["Collect", "Extract", "Verify", "Score", "Brief"];

export function ReviewStatusStrip({
  scan,
  traces,
  pollingError,
}: {
  scan: ScanStatusResponse | null;
  traces: BrightDataTrace[];
  pollingError: string | null;
}) {
  const sourceSummary = summarizeSourceModes(traces, scan?.mode);
  const sourceModes = getSourceModes(traces);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink-950">
            Autonomous Review Cycle
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            {"Polling GET /api/scans/{id} every 2 seconds while active."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {scan ? (
            <>
              <Badge tone={scanStatusTone(scan.status)}>
                {labelize(scan.status)}
              </Badge>
              <Badge tone={sourceSummary.tone}>{sourceSummary.label}</Badge>
              {sourceModes.map((mode) => (
                <SourceModeBadge key={mode} mode={mode} />
              ))}
            </>
          ) : (
            <Badge>Awaiting due scan</Badge>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-5">
        {(scan?.stages ??
          stageLabels.map((label) => ({
            name: label.toLowerCase(),
            status: "pending" as StageStatus,
          }))).map((stage, index) => (
          <div
            key={stage.name}
            className="relative overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                {stageLabels[index]}
              </span>
              <StageIcon status={stage.status} />
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-200">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  stage.status === "completed"
                    ? "w-full bg-signal-600"
                    : stage.status === "running"
                      ? "w-2/3 animate-pulse bg-caution-500"
                      : "w-0 bg-zinc-300"
                }`}
              />
            </div>
          </div>
        ))}
      </div>

      {scan ? (
        <>
          <p className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-600">
            {sourceSummary.detail}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-4 text-xs sm:grid-cols-5">
            <Metric label="SERP" value={scan.metrics.serp_queries_used} max={6} />
            <Metric label="URLs" value={scan.metrics.urls_scraped} max={12} />
            <Metric label="LLM" value={scan.metrics.llm_calls_used} max={20} />
            <Metric label="Evidence" value={scan.metrics.evidence_count} />
            <Metric label="Verified" value={scan.metrics.verified_count} />
          </div>
        </>
      ) : null}

      {pollingError ? (
        <p className="mt-4 flex items-center gap-2 rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <WarningCircle size={16} /> {pollingError}
        </p>
      ) : null}
    </section>
  );
}

function StageIcon({ status }: { status: StageStatus }) {
  if (status === "completed") {
    return <Check size={16} weight="bold" className="text-signal-600" />;
  }

  if (status === "failed") {
    return <WarningCircle size={16} weight="bold" className="text-rose-600" />;
  }

  return (
    <CircleDashed
      size={16}
      className={status === "running" ? "animate-spin text-caution-500" : "text-zinc-400"}
    />
  );
}

function Metric({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max?: number;
}) {
  return (
    <div>
      <p className="text-zinc-500">{label}</p>
      <p className="mt-1 font-mono text-sm font-semibold text-ink-950">
        {value}
        {max ? <span className="text-zinc-400">/{max}</span> : null}
      </p>
    </div>
  );
}
