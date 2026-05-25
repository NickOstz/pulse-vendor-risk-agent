"use client";

import { useEffect, useState } from "react";
import { getScan } from "@/lib/api";
import type { ScanStatusResponse } from "@/lib/types";

const terminalStatuses = new Set([
  "completed",
  "failed",
  "completed_with_fallback",
]);

export function useScanPolling(scanId: string | null) {
  const [scan, setScan] = useState<ScanStatusResponse | null>(null);
  const [pollingError, setPollingError] = useState<string | null>(null);

  useEffect(() => {
    if (!scanId) return;

    let cancelled = false;
    const currentScanId = scanId;

    async function poll() {
      try {
        const nextScan = await getScan(currentScanId);
        if (cancelled) return;
        setScan(nextScan);
        setPollingError(null);
      } catch (error) {
        if (cancelled) return;
        setPollingError(
          error instanceof Error ? error.message : "Unable to poll scan status.",
        );
      }
    }

    void poll();
    const intervalId = window.setInterval(() => {
      if (!scan || !terminalStatuses.has(scan.status)) {
        void poll();
      }
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [scanId, scan]);

  const isTerminal = scan ? terminalStatuses.has(scan.status) : false;

  return {
    scan,
    pollingError,
    isTerminal,
  };
}
