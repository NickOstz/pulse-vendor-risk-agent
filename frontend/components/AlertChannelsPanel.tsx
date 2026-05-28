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

export function AlertChannelsPanel() {
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
