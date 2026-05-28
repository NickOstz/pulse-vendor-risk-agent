"use client";

import { useState } from "react";
import {
  CheckCircle,
  Clock,
  DiscordLogo,
  EnvelopeSimple,
  MapPinLine,
  PaperPlaneTilt,
  Pulse,
  SealCheck,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { Badge } from "@/components/Badge";
import { labelize } from "@/lib/formatters";
import { summarizeSourceModes } from "@/lib/sourceModes";
import type {
  AgentStatusResponse,
  BrightDataTrace,
  Company,
  ScanStatusResponse,
} from "@/lib/types";

type AlertChannel = "email" | "whatsapp" | "discord";

type AlertChannelState = Record<AlertChannel, string>;
type AlertChannelFeedback = Partial<Record<AlertChannel, string>>;

const emptyAlertChannels: AlertChannelState = {
  email: "",
  whatsapp: "",
  discord: "",
};

const channelCopy: Record<
  AlertChannel,
  {
    label: string;
    placeholder: string;
    type: string;
    icon: React.ReactNode;
  }
> = {
  email: {
    label: "Email",
    placeholder: "risk-team@company.com",
    type: "email",
    icon: <EnvelopeSimple size={17} />,
  },
  whatsapp: {
    label: "WhatsApp",
    placeholder: "+1 415 555 0182",
    type: "tel",
    icon: <WhatsappLogo size={17} />,
  },
  discord: {
    label: "Discord webhook",
    placeholder: "https://discord.com/api/webhooks/...",
    type: "url",
    icon: <DiscordLogo size={17} />,
  },
};

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
  const [channels, setChannels] =
    useState<AlertChannelState>(emptyAlertChannels);
  const [savedChannels, setSavedChannels] =
    useState<AlertChannelFeedback>({});
  const [channelErrors, setChannelErrors] =
    useState<AlertChannelFeedback>({});

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
      ? "Watching public sources for vendor-risk signals"
      : "Inactive";

  const activeRun = agentStatus?.active_runs.find(
    (run) => run.company_id === company.id,
  );
  const nextSweepLabel = scan
    ? scan.status === "running"
      ? "Scanning now"
      : "Continuous watch"
    : company.agent_enabled && isDueNow(company.next_agent_run_at)
      ? "Scanning now"
      : company.agent_enabled
        ? "Continuous watch"
        : "Not armed";

  function handleChannelChange(channel: AlertChannel, value: string) {
    setChannels((currentChannels) => ({
      ...currentChannels,
      [channel]: value,
    }));
    setSavedChannels((currentFeedback) => ({
      ...currentFeedback,
      [channel]: undefined,
    }));
    setChannelErrors((currentErrors) => ({
      ...currentErrors,
      [channel]: undefined,
    }));
  }

  function handleChannelSave(channel: AlertChannel) {
    const value = channels[channel].trim();
    const validationError = validateAlertChannel(channel, value);

    if (validationError) {
      setChannelErrors((currentErrors) => ({
        ...currentErrors,
        [channel]: validationError,
      }));
      setSavedChannels((currentFeedback) => ({
        ...currentFeedback,
        [channel]: undefined,
      }));
      return;
    }

    setChannels((currentChannels) => ({
      ...currentChannels,
      [channel]: value,
    }));
    setChannelErrors((currentErrors) => ({
      ...currentErrors,
      [channel]: undefined,
    }));
    setSavedChannels((currentFeedback) => ({
      ...currentFeedback,
      [channel]: "Ready",
    }));
  }

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
          value={company.agent_enabled ? "Realtime monitoring" : "Realtime ready"}
        />
        <StatusRow
          icon={<Clock size={17} />}
          label="Next sweep"
          value={nextSweepLabel}
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

      <div className="mt-4 border-t border-zinc-100 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Alert Channels
            </h3>
            <p className="mt-1 text-sm font-medium text-ink-950">
              Route verified alerts
            </p>
          </div>
          <Badge tone="neutral">mock</Badge>
        </div>
        <div className="mt-3 grid gap-2">
          {(Object.keys(channelCopy) as AlertChannel[]).map((channel) => (
            <AlertChannelControl
              key={channel}
              channel={channel}
              value={channels[channel]}
              feedback={savedChannels[channel]}
              error={channelErrors[channel]}
              onChange={handleChannelChange}
              onSave={handleChannelSave}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function isDueNow(value: string | null) {
  if (!value) return false;
  return new Date(value).getTime() <= Date.now();
}

function AlertChannelControl({
  channel,
  value,
  feedback,
  error,
  onChange,
  onSave,
}: {
  channel: AlertChannel;
  value: string;
  feedback?: string;
  error?: string;
  onChange: (channel: AlertChannel, value: string) => void;
  onSave: (channel: AlertChannel) => void;
}) {
  const config = channelCopy[channel];
  const isSaved = Boolean(feedback);

  return (
    <div
      className={`rounded-md border p-2 transition ${
        isSaved
          ? "border-signal-100 bg-signal-50"
          : error
            ? "border-rose-100 bg-rose-50"
            : "border-zinc-200 bg-zinc-50"
      }`}
    >
      <label className="flex items-center gap-2 text-xs font-medium text-zinc-600">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-zinc-600">
          {config.icon}
        </span>
        {config.label}
      </label>
      <div className="mt-2 flex gap-2">
        <input
          type={config.type}
          value={value}
          placeholder={config.placeholder}
          onChange={(event) => onChange(channel, event.target.value)}
          className="h-9 min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-3 text-xs text-ink-950 outline-none transition placeholder:text-zinc-400 focus:border-ink-900 focus:ring-2 focus:ring-ink-900/10"
        />
        <button
          type="button"
          onClick={() => onSave(channel)}
          className={`inline-flex h-9 w-10 shrink-0 items-center justify-center rounded-md border transition active:scale-[0.98] ${
            isSaved
              ? "border-signal-200 bg-white text-signal-700"
              : "border-zinc-200 bg-white text-ink-900 hover:border-zinc-300"
          }`}
          aria-label={`Save ${config.label} alert channel`}
          title={`Save ${config.label}`}
        >
          {isSaved ? (
            <CheckCircle size={17} weight="fill" />
          ) : (
            <PaperPlaneTilt size={16} weight="bold" />
          )}
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-xs font-medium text-rose-700">{error}</p>
      ) : feedback ? (
        <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-signal-700">
          <CheckCircle size={14} weight="fill" />
          {feedback}
        </p>
      ) : null}
    </div>
  );
}

function validateAlertChannel(channel: AlertChannel, value: string) {
  if (!value) return "Add a destination first.";

  if (channel === "email") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      ? null
      : "Use a valid email address.";
  }

  if (channel === "whatsapp") {
    const digits = value.replace(/[^\d]/g, "");
    return digits.length >= 8 ? null : "Use a phone number with country code.";
  }

  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      url.hostname === "discord.com" &&
      url.pathname.startsWith("/api/webhooks/")
    ) {
      return null;
    }
  } catch {
    return "Use a Discord webhook URL.";
  }

  return "Use a Discord webhook URL.";
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
