import {
  alertsFixture,
  briefFixture,
  companiesFixture,
  demoCompanyId,
  demoScanId,
  evidenceFixture,
  scanProgression,
  tracesFixture,
} from "@/lib/fixtures";
import type {
  AgentStatusResponse,
  Alert,
  AlertReviewStatus,
  BrightDataTrace,
  Company,
  EvidenceItem,
  HealthResponse,
  ScanStatusResponse,
  VendorReviewBrief,
} from "@/lib/types";

type AlertFilters = {
  company_id?: string;
  scan_id?: string;
};

type TickResponse = Partial<AgentStatusResponse> & {
  scan_id?: string;
  scan_ids?: string[];
  started_scan_id?: string;
  started_scan_ids?: string[];
  due_vendor_ids?: string[];
  started_scans?: Array<{ id?: string; scan_id?: string; company_id?: string }>;
};

let companies = structuredClone(companiesFixture);
let alerts = structuredClone(alertsFixture);
let scanStep = 0;
let activeScanId: string | null = null;

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

export const usesFixtureData = !apiBaseUrl;

const fixtureHealth: HealthResponse = {
  status: "ok",
  database: true,
  scheduler: true,
  replay_data: true,
  brightdata_key_present: false,
  llm_key_present: false,
};

async function requestJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T | null> {
  if (!apiBaseUrl) return null;

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Pulse API request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

export async function listCompanies(): Promise<Company[]> {
  const live = await requestJson<Company[]>("/api/companies");
  return live ?? companies;
}

export async function getDemoHealth(): Promise<HealthResponse> {
  const live = await requestJson<HealthResponse>("/api/health");
  return live ?? fixtureHealth;
}

export async function setVendorRiskAgent(
  companyId: string,
  agentEnabled: boolean,
): Promise<Company> {
  const live = await requestJson<Company>(
    `/api/companies/${companyId}/agent`,
    {
      method: "PATCH",
      body: JSON.stringify({ agent_enabled: agentEnabled }),
    },
  );

  if (live) return live;

  companies = companies.map((company) => {
    if (company.id !== companyId) return company;

    if (!agentEnabled) {
      activeScanId = null;
      return {
        ...company,
        agent_enabled: false,
        agent_status: "inactive",
        review_policy: null,
        next_agent_run_at: null,
      };
    }

    activeScanId = null;
    scanStep = 0;

    return {
      ...company,
      agent_enabled: true,
      agent_status: "active",
      review_policy:
        company.criticality === "critical"
          ? "critical_renewal_due"
          : "weekly",
      next_agent_run_at: "2026-05-26T03:44:00Z",
    };
  });

  const updatedCompany = companies.find((company) => company.id === companyId);
  if (!updatedCompany) {
    throw new Error(`Unknown company: ${companyId}`);
  }

  return updatedCompany;
}

export async function runAgentTick(): Promise<AgentStatusResponse> {
  const live = await requestJson<TickResponse>("/api/agents/tick", {
    method: "POST",
  });

  if (live) {
    const tickStatus = normalizeTickResponse(live);
    try {
      const agentStatus = await getAgentStatus();
      return agentStatus.active_runs.length > 0 ? agentStatus : tickStatus;
    } catch {
      return tickStatus;
    }
  }

  const dueVendorId =
    companies.find(
      (company) =>
        company.agent_enabled &&
        company.id === demoCompanyId &&
        company.agent_status !== "running",
    )?.id ?? null;

  if (!dueVendorId) {
    return getAgentStatus();
  }

  activeScanId = demoScanId;
  scanStep = 0;
  companies = companies.map((company) =>
    company.id === dueVendorId
      ? {
          ...company,
          agent_status: "running",
        }
      : company,
  );

  return {
    active_runs: [
      {
        company_id: dueVendorId,
        scan_id: activeScanId,
        current_stage: scanProgression[scanStep].current_stage,
      },
    ],
    due_vendors: [],
  };
}

export async function getAgentStatus(): Promise<AgentStatusResponse> {
  const live = await requestJson<AgentStatusResponse>("/api/agents/status");
  if (live) return live;

  return {
    active_runs: activeScanId
      ? [
          {
            company_id: demoCompanyId,
            scan_id: activeScanId,
            current_stage: scanProgression[scanStep].current_stage,
          },
        ]
      : [],
    due_vendors: activeScanId
      ? []
      : companies.filter((company) => company.id === demoCompanyId),
  };
}

export async function getScan(scanId: string): Promise<ScanStatusResponse> {
  const live = await requestJson<ScanStatusResponse>(`/api/scans/${scanId}`);
  if (live) return live;

  const scan = scanProgression[Math.min(scanStep, scanProgression.length - 1)];
  scanStep = Math.min(scanStep + 1, scanProgression.length - 1);

  if (
    scan.status === "completed" ||
    scan.status === "completed_with_fallback" ||
    scan.status === "failed"
  ) {
    activeScanId = null;
    companies = companies.map((company) =>
      company.id === scan.company_id
        ? {
            ...company,
            agent_status:
              scan.status === "failed" ? "needs_review" : "completed",
            last_agent_run_at: "2026-05-26T03:49:00Z",
            next_agent_run_at: "2026-05-27T03:49:00Z",
          }
        : company,
    );
  }

  return scan;
}

export async function listAlerts(
  filters: AlertFilters = {},
): Promise<Alert[]> {
  const params = new URLSearchParams();
  if (filters.company_id) params.set("company_id", filters.company_id);
  if (filters.scan_id) params.set("scan_id", filters.scan_id);

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const live = await requestJson<Alert[]>(`/api/alerts${suffix}`);
  if (live) return live;

  return alerts.filter((alert) => {
    if (filters.company_id && alert.company_id !== filters.company_id) {
      return false;
    }
    if (filters.scan_id && alert.scan_id !== filters.scan_id) {
      return false;
    }
    return true;
  });
}

export async function updateAlertReviewStatus(
  alertId: string,
  status: AlertReviewStatus,
): Promise<Alert> {
  const live = await requestJson<Alert>(`/api/alerts/${alertId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

  if (live) return live;

  let updatedAlert: Alert | null = null;
  alerts = alerts.map((alert) => {
    if (alert.id !== alertId) return alert;
    updatedAlert = { ...alert, status };
    return updatedAlert;
  });

  if (!updatedAlert) {
    throw new Error(`Unknown alert: ${alertId}`);
  }

  return updatedAlert;
}

export async function listEvidence(
  companyId: string,
  scanId?: string,
): Promise<EvidenceItem[]> {
  const suffix = scanId ? `?scan_id=${encodeURIComponent(scanId)}` : "";
  const live = await requestJson<EvidenceItem[]>(
    `/api/companies/${companyId}/evidence${suffix}`,
  );
  if (live) return live;

  return evidenceFixture.filter((item) => {
    if (item.company_id !== companyId) return false;
    return scanId ? item.scan_id === scanId : true;
  });
}

export async function listBrightDataTraces(
  scanId: string,
): Promise<BrightDataTrace[]> {
  const live = await requestJson<BrightDataTrace[]>(
    `/api/brightdata/traces?scan_id=${encodeURIComponent(scanId)}`,
  );
  if (live) return live;

  return tracesFixture.filter((trace) => trace.scan_id === scanId);
}

export async function getVendorReviewBrief(
  companyId: string,
  scanId: string,
  format: VendorReviewBrief["format"] = "markdown",
): Promise<VendorReviewBrief> {
  const live = await requestJson<VendorReviewBrief>(
    "/api/briefs/vendor-review",
    {
      method: "POST",
      body: JSON.stringify({
        company_id: companyId,
        scan_id: scanId,
        format,
      }),
    },
  );

  if (live) return live;
  if (format === "html") {
    return {
      ...briefFixture,
      format: "html",
      content: htmlBriefFixtureContent,
    };
  }
  return briefFixture;
}

const htmlBriefFixtureContent =
  "<article><h1>Vendor Risk Assessment Brief: Cloudflare</h1><h2>Summary</h2><p>Cloudflare is a critical edge security vendor with renewal on 2026-07-10. Pulse assembled 1 live and 2 fallback verified public-source signals for renewal review.</p><h2>Key Verified Changes</h2><ul><li>Cloudflare publicly identifies SOC 2 Type II and ISO 27001 among its compliance resources.</li><li>Cloudflare identifies Data Localization Suite as an Enterprise-only paid add-on.</li><li>Cloudflare reported a resolved May 2026 Log Explorer incident that could delay dashboard and API log visibility.</li></ul><h2>Evidence Table</h2><table><thead><tr><th>Signal</th><th>Mode</th><th>Support</th><th>Source</th><th>Recommended action</th></tr></thead><tbody><tr><td>Trust / security</td><td>live</td><td>verified</td><td>https://www.cloudflare.com/trust-hub/</td><td>Request the current in-scope compliance package for the renewal record.</td></tr><tr><td>Pricing / terms</td><td>fallback</td><td>verified</td><td>https://developers.cloudflare.com/data-localization/</td><td>Confirm whether regulated-data residency requirements require this add-on in the renewal scope.</td></tr><tr><td>Operational / adverse media</td><td>fallback</td><td>verified</td><td>https://www.cloudflarestatus.com/</td><td>Confirm whether monitoring or audit-log workflows relied on Log Explorer during the incident window.</td></tr></tbody></table><h2>Risk Interpretation</h2><p>These verified public statements are review triggers, not proof of a control failure or unresolved incident. Security and Procurement should confirm assurance documentation, commercial scope, and any operational impact before renewal.</p><h2>Recommended Action</h2><ul><li>Request the current in-scope compliance package for the renewal record.</li><li>Confirm whether regulated-data residency requirements require this add-on in the renewal scope.</li><li>Confirm whether monitoring or audit-log workflows relied on Log Explorer during the incident window.</li></ul><h2>Suggested Owner</h2><p>Security, with Procurement support.</p><h2>Review Status</h2><p>Needs review before renewal. This brief includes only verified evidence: 1 live and 2 fallback verified public-source signals.</p></article>";

function normalizeTickResponse(response: TickResponse): AgentStatusResponse {
  const activeRuns = response.active_runs ?? [];
  const startedScans = response.started_scans ?? [];

  const startedRuns = startedScans.flatMap((scan) => {
    const scanId = scan.scan_id ?? scan.id;
    if (!scanId || !scan.company_id) return [];

    return [
      {
        company_id: scan.company_id,
        scan_id: scanId,
        current_stage: "collect" as const,
      },
    ];
  });

  const looseScanIds = [
    response.scan_id,
    response.started_scan_id,
    ...(response.scan_ids ?? []),
    ...(response.started_scan_ids ?? []),
  ].filter((scanId): scanId is string => Boolean(scanId));

  const looseRuns = looseScanIds.map((scanId) => ({
    company_id: "",
    scan_id: scanId,
    current_stage: "collect" as const,
  }));

  return {
    active_runs:
      activeRuns.length > 0
        ? activeRuns
        : startedRuns.length > 0
          ? startedRuns
          : looseRuns,
    due_vendors: response.due_vendors ?? [],
  };
}
