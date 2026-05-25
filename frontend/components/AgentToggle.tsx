"use client";

import { Power, ShieldCheck } from "@phosphor-icons/react";
import type { Company } from "@/lib/types";

export function AgentToggle({
  company,
  busy,
  onToggle,
}: {
  company: Company;
  busy: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} weight="duotone" className="text-signal-700" />
            <h2 className="text-sm font-semibold text-ink-950">
              Vendor Risk Agent
            </h2>
          </div>
          <p className="mt-2 max-w-[42ch] text-sm leading-6 text-zinc-600">
            Autonomous monitoring for public vendor-risk evidence. Frontend is
            currently using contract-shaped fixtures.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggle(!company.agent_enabled)}
          className={`relative inline-flex h-9 w-[4.75rem] shrink-0 items-center rounded-full border p-1 transition duration-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
            company.agent_enabled
              ? "border-signal-600 bg-signal-600"
              : "border-zinc-300 bg-zinc-100"
          }`}
          aria-pressed={company.agent_enabled}
          aria-label="Toggle Vendor Risk Agent"
        >
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full bg-white text-ink-900 shadow-sm transition duration-300 ${
              company.agent_enabled ? "translate-x-9" : "translate-x-0"
            }`}
          >
            <Power size={15} weight="bold" />
          </span>
        </button>
      </div>
    </div>
  );
}
