"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle,
  DiscordLogo,
  EnvelopeSimple,
  PaperPlaneTilt,
  WhatsappLogo,
} from "@phosphor-icons/react";

type AlertChannel = "email" | "whatsapp" | "discord";

type AlertChannelState = Record<AlertChannel, string>;
type AlertChannelFeedback = Partial<Record<AlertChannel, string>>;

const alertChannelsStorageKey = "pulse.alertChannels";

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
    accent: string;
    icon: React.ReactNode;
  }
> = {
  email: {
    label: "Email",
    placeholder: "risk-team@company.com",
    type: "email",
    accent: "#EA4335",
    icon: <EnvelopeSimple size={19} weight="bold" />,
  },
  whatsapp: {
    label: "WhatsApp",
    placeholder: "+1 415 555 0182",
    type: "tel",
    accent: "#25D366",
    icon: <WhatsappLogo size={20} weight="fill" />,
  },
  discord: {
    label: "Discord webhook",
    placeholder: "https://discord.com/api/webhooks/...",
    type: "url",
    accent: "#5865F2",
    icon: <DiscordLogo size={20} weight="fill" />,
  },
};

export function AlertChannelsPanel({ locked = false }: { locked?: boolean }) {
  const [channels, setChannels] =
    useState<AlertChannelState>(emptyAlertChannels);
  const [savedChannels, setSavedChannels] =
    useState<AlertChannelFeedback>({});
  const [channelErrors, setChannelErrors] =
    useState<AlertChannelFeedback>({});

  useEffect(() => {
    const storedChannels = readStoredAlertChannels();
    setChannels(storedChannels);
    setSavedChannels(readyFeedbackForChannels(storedChannels));
  }, []);

  function handleChannelChange(channel: AlertChannel, value: string) {
    if (locked) return;
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
    if (locked) return;
    if (savedChannels[channel]) {
      setSavedChannels((currentFeedback) => ({
        ...currentFeedback,
        [channel]: undefined,
      }));
      setChannelErrors((currentErrors) => ({
        ...currentErrors,
        [channel]: undefined,
      }));
      return;
    }

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
    writeStoredAlertChannels({
      ...readStoredAlertChannels(),
      [channel]: value,
    });
  }

  return (
    <div className="mt-6 border-t border-zinc-100 pt-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
          Alert Channels
        </h3>
        <p className="mt-1 text-sm font-medium text-ink-950">
          Route verified alerts
        </p>
      </div>
      <div className="mt-3 grid gap-2">
        {(Object.keys(channelCopy) as AlertChannel[]).map((channel) => (
          <AlertChannelControl
            key={channel}
            channel={channel}
            value={channels[channel]}
            feedback={savedChannels[channel]}
            error={channelErrors[channel]}
            locked={locked}
            onChange={handleChannelChange}
            onSave={handleChannelSave}
          />
        ))}
      </div>
    </div>
  );
}

function readStoredAlertChannels(): AlertChannelState {
  if (typeof window === "undefined") return emptyAlertChannels;

  try {
    const storedValue = window.localStorage.getItem(alertChannelsStorageKey);
    if (!storedValue) return emptyAlertChannels;

    const parsedValue: unknown = JSON.parse(storedValue);
    if (!parsedValue || typeof parsedValue !== "object") {
      return emptyAlertChannels;
    }

    return {
      email: stringValue(parsedValue, "email"),
      whatsapp: stringValue(parsedValue, "whatsapp"),
      discord: stringValue(parsedValue, "discord"),
    };
  } catch {
    return emptyAlertChannels;
  }
}

function writeStoredAlertChannels(channels: AlertChannelState) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      alertChannelsStorageKey,
      JSON.stringify(channels),
    );
  } catch {
    // Ignore storage failures; the visible save feedback still confirms the UI state.
  }
}

function readyFeedbackForChannels(channels: AlertChannelState): AlertChannelFeedback {
  return Object.fromEntries(
    (Object.keys(channels) as AlertChannel[])
      .filter((channel) => channels[channel])
      .map((channel) => [channel, "Ready"]),
  );
}

function stringValue(value: object, key: AlertChannel) {
  return key in value && typeof value[key as keyof typeof value] === "string"
    ? value[key as keyof typeof value]
    : "";
}

function AlertChannelControl({
  channel,
  value,
  feedback,
  error,
  locked,
  onChange,
  onSave,
}: {
  channel: AlertChannel;
  value: string;
  feedback?: string;
  error?: string;
  locked: boolean;
  onChange: (channel: AlertChannel, value: string) => void;
  onSave: (channel: AlertChannel) => void;
}) {
  const config = channelCopy[channel];
  const isSaved = Boolean(feedback);
  const inputLocked = locked || isSaved;
  const displayValue = isSaved ? maskAlertChannel(channel, value) : value;

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
      <label className="flex items-center gap-2 text-xs font-semibold text-ink-950">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-md bg-black/35 text-ink-950"
          style={{ color: config.accent }}
        >
          {config.icon}
        </span>
        <span>{config.label}</span>
      </label>
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={displayValue}
          placeholder={config.placeholder}
          readOnly={inputLocked}
          disabled={locked}
          onChange={(event) => onChange(channel, event.target.value)}
          className="h-9 min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-3 text-xs text-ink-950 outline-none transition placeholder:text-zinc-400 read-only:cursor-default disabled:cursor-not-allowed disabled:opacity-60 focus:border-ink-900 focus:ring-2 focus:ring-ink-900/10"
        />
        <button
          type="button"
          disabled={locked}
          onClick={() => onSave(channel)}
          className={`inline-flex h-9 w-10 shrink-0 items-center justify-center rounded-md border transition active:scale-[0.98] ${
            isSaved
              ? "border-signal-200 bg-white text-signal-700"
              : "border-zinc-200 bg-white text-ink-900 hover:border-zinc-300"
          } disabled:cursor-not-allowed disabled:opacity-50`}
          aria-label={`Save ${config.label} alert channel`}
          title={
            locked
              ? "Operator token required"
              : isSaved
                ? `Change ${config.label}`
                : `Save ${config.label}`
          }
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
          <span className="livedot" style={{ width: 8, height: 8 }} />
          {feedback}
        </p>
      ) : null}
    </div>
  );
}

function maskAlertChannel(channel: AlertChannel, value: string) {
  if (!value) return "";

  if (channel === "email") {
    const [localPart, domain] = value.split("@");
    if (!domain) return maskMiddle(value, 2, 3);
    return `${maskMiddle(localPart, 2, 1)}@${domain}`;
  }

  if (channel === "whatsapp") {
    const compact = value.replace(/\s+/g, "");
    return maskMiddle(compact, 4, 3);
  }

  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    const webhookId = parts[2] ?? "";
    return `${url.origin}/api/webhooks/${maskMiddle(webhookId, 4, 3)}/...`;
  } catch {
    return maskMiddle(value, 12, 3);
  }
}

function maskMiddle(value: string, visibleStart: number, visibleEnd: number) {
  if (value.length <= visibleStart + visibleEnd + 2) {
    return `${value.slice(0, 1)}...${value.slice(-1)}`;
  }

  return `${value.slice(0, visibleStart)}...${value.slice(-visibleEnd)}`;
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
    const host = url.hostname.toLowerCase();
    const isDiscordHost =
      host === "discord.com" ||
      host === "discordapp.com" ||
      host.endsWith(".discord.com");
    if (
      url.protocol === "https:" &&
      isDiscordHost &&
      url.pathname.startsWith("/api/webhooks/")
    ) {
      return null;
    }
  } catch {
    return "Use a Discord webhook URL.";
  }

  return "Use a Discord webhook URL.";
}
