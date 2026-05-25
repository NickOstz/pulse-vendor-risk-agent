import type {
  BrightDataTrace,
  ScanMode,
  ScanStatus,
  SourceMode,
} from "@/lib/types";

export type Tone = "neutral" | "good" | "warn" | "danger";

const sourceModeOrder: SourceMode[] = ["live", "cached", "fallback"];

export function getSourceModes(traces: BrightDataTrace[]) {
  return sourceModeOrder.filter((mode) =>
    traces.some((trace) => trace.source_mode === mode),
  );
}

export function countSourceMode(traces: BrightDataTrace[], mode: SourceMode) {
  return traces.filter((trace) => trace.source_mode === mode).length;
}

export function summarizeSourceModes(
  traces: BrightDataTrace[],
  scanMode?: ScanMode | null,
) {
  const modes = getSourceModes(traces);

  if (modes.includes("fallback")) {
    return {
      label: "Fallback evidence used",
      detail: "A live attempt was preserved and cached fallback data completed the review.",
      tone: "warn" as Tone,
      modes,
    };
  }

  if (modes.includes("cached")) {
    return {
      label: modes.includes("live") ? "Live plus cached evidence" : "Cached evidence",
      detail: "Cached source data is labeled in the trace rows.",
      tone: "neutral" as Tone,
      modes,
    };
  }

  if (modes.includes("live")) {
    return {
      label: "Live source collection",
      detail: "Trace rows show live public-web collection.",
      tone: "good" as Tone,
      modes,
    };
  }

  if (scanMode === "replay") {
    return {
      label: "Replay mode",
      detail: "Replay data will appear here once traces are available.",
      tone: "neutral" as Tone,
      modes,
    };
  }

  if (scanMode === "live_with_fallback") {
    return {
      label: "Live with fallback policy",
      detail: "The review may use fallback data if live collection fails or times out.",
      tone: "warn" as Tone,
      modes,
    };
  }

  return {
    label: "No source traces yet",
    detail: "Source mode labels will appear after collection begins.",
    tone: "neutral" as Tone,
    modes,
  };
}

export function scanStatusTone(status?: ScanStatus | null): Tone {
  switch (status) {
    case "completed":
      return "good";
    case "completed_with_fallback":
      return "warn";
    case "failed":
      return "danger";
    case "running":
    case "queued":
      return "neutral";
    default:
      return "neutral";
  }
}

export function sourceModeDescription(mode: SourceMode) {
  switch (mode) {
    case "live":
      return "Live";
    case "cached":
      return "Cached";
    case "fallback":
      return "Fallback";
  }
}
