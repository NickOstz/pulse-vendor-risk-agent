import { Badge } from "@/components/Badge";
import type { HealthResponse } from "@/lib/types";

export function DemoHealthIndicator({
  health,
  loading,
  fixtureMode,
}: {
  health: HealthResponse | null;
  loading: boolean;
  fixtureMode: boolean;
}) {
  const coreReady =
    health?.status === "ok" &&
    health.database &&
    health.scheduler &&
    health.replay_data;

  return (
    <details className="group relative">
      <summary className="cursor-pointer list-none">
        <Badge tone={loading ? "neutral" : coreReady ? "good" : "warn"}>
          {loading ? "Checking readiness" : coreReady ? "Demo ready" : "Check readiness"}
        </Badge>
      </summary>
      <div className="absolute left-0 top-9 z-20 w-72 rounded-lg border border-zinc-200 bg-white p-3 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
          Demo readiness
        </p>
        {loading || !health ? (
          <p className="mt-3 text-sm text-zinc-500">
            {loading ? "Checking available dependencies..." : "Readiness check unavailable."}
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            <ReadinessRow
              label={fixtureMode ? "Fixture replay" : "Backend API"}
              ready={health.status === "ok"}
            />
            <ReadinessRow label="Database" ready={health.database} />
            <ReadinessRow label="Scheduler" ready={health.scheduler} />
            <ReadinessRow label="Replay evidence" ready={health.replay_data} />
            <ReadinessRow
              label="Bright Data live proof"
              ready={health.brightdata_key_present}
              optional
            />
            <ReadinessRow
              label="LLM extraction proof"
              ready={health.llm_key_present}
              optional
            />
          </div>
        )}
        <p className="mt-3 border-t border-zinc-100 pt-3 text-xs leading-5 text-zinc-500">
          Live proof keys are optional. Replay remains the credential-free demo path.
        </p>
      </div>
    </details>
  );
}

function ReadinessRow({
  label,
  ready,
  optional = false,
}: {
  label: string;
  ready: boolean;
  optional?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-zinc-600">{label}</span>
      <span
        className={
          ready
            ? "font-medium text-signal-700"
            : optional
              ? "font-medium text-zinc-500"
              : "font-medium text-caution-700"
        }
      >
        {ready ? "ready" : optional ? "optional" : "unavailable"}
      </span>
    </div>
  );
}
