"use client";

import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowRight,
  Moon,
  Plus,
  Power,
  ShieldWarning,
  Sun,
  X,
} from "@phosphor-icons/react";
import { AgentStatusPanel } from "@/components/AgentStatusPanel";
import { AgentToggle } from "@/components/AgentToggle";
import { Badge } from "@/components/Badge";
import { DemoHealthIndicator } from "@/components/DemoHealthIndicator";
import { EvidenceDrawer } from "@/components/EvidenceDrawer";
import { OperatorAccess } from "@/components/OperatorAccess";
import { ReviewStatusStrip } from "@/components/ReviewStatusStrip";
import { RiskAssessmentBrief } from "@/components/RiskAssessmentBrief";
import { SourceRulesPanel } from "@/components/SourceRulesPanel";
import { VendorCard } from "@/components/VendorCard";
import { useScanPolling } from "@/hooks/useScanPolling";
import {
  createCompany,
  deleteCompany,
  getAgentStatus,
  getDemoHealth,
  getLatestScan,
  getScan,
  getVendorReviewBrief,
  listAlerts,
  listBrightDataTraces,
  listCompanies,
  listEvidence,
  hasOperatorToken,
  runAgentTick,
  setVendorRiskAgent,
  setWatchlistRiskAgent,
  updateCompanySourceRules,
  usesFixtureData,
  verifyStoredOperatorToken,
} from "@/lib/api";
import { formatDate, labelize } from "@/lib/formatters";
import { saveVendorMcpServerUrl } from "@/lib/vendorMcp";
import type {
  AgentStatusResponse,
  Alert,
  BrightDataTrace,
  Company,
  EvidenceItem,
  HealthResponse,
  ScanStatusResponse,
  VendorReviewBrief,
} from "@/lib/types";

type VendorFormState = {
  name: string;
  domain: string;
  relationship_type: string;
  owner: string;
  renewal_date: string;
  mcp_server_url: string;
  allow_list_text: string;
  block_list_text: string;
};

type ThemeMode = "light" | "dark";
type SeenVendorAlertKeys = Record<string, string[]>;

const seenVendorAlertKeysStorageKey = "pulse.seenVendorAlertKeys";
const legacySeenVendorAlertIdsStorageKey = "pulse.seenVendorAlertIds";

const emptyVendorForm: VendorFormState = {
  name: "",
  domain: "",
  relationship_type: "",
  owner: "",
  renewal_date: "",
  mcp_server_url: "",
  allow_list_text: "",
  block_list_text: "",
};

export function CommandCenter() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    null,
  );
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [watchlistAlerts, setWatchlistAlerts] = useState<Alert[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [traces, setTraces] = useState<BrightDataTrace[]>([]);
  const [brief, setBrief] = useState<VendorReviewBrief | null>(null);
  const [assessmentScan, setAssessmentScan] =
    useState<ScanStatusResponse | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatusResponse | null>(null);
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(
    null,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [vendorFormOpen, setVendorFormOpen] = useState(false);
  const [vendorForm, setVendorForm] =
    useState<VendorFormState>(emptyVendorForm);
  const [vendorSubmitting, setVendorSubmitting] = useState(false);
  const [vendorDeletingId, setVendorDeletingId] = useState<string | null>(null);
  const [vendorFormError, setVendorFormError] = useState<string | null>(null);
  const [vendorFormNotice, setVendorFormNotice] = useState<string | null>(null);
  const [watchlistBusy, setWatchlistBusy] = useState(false);
  const [operatorTokenSet, setOperatorTokenSet] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [themeReady, setThemeReady] = useState(false);
  const [seenVendorAlertKeys, setSeenVendorAlertKeys] =
    useState<SeenVendorAlertKeys>({});

  const { scan, pollingError, isTerminal } = useScanPolling(activeScanId);
  const displayScan = scan ?? assessmentScan;

  const sortedCompanies = useMemo(
    () =>
      [...companies].sort((a, b) => {
        const alertRank =
          getVendorAttentionRank(b, watchlistAlerts, seenVendorAlertKeys) -
          getVendorAttentionRank(a, watchlistAlerts, seenVendorAlertKeys);

        if (alertRank !== 0) return alertRank;

        return a.name.localeCompare(b.name);
      }),
    [companies, watchlistAlerts, seenVendorAlertKeys],
  );

  const selectedCompany =
    companies.find((company) => company.id === selectedCompanyId) ??
    companies[0] ??
    null;

  const selectedAlerts = alerts.filter(
    (alert) => alert.company_id === selectedCompany?.id,
  );
  const monitoredVendorCount = companies.filter(
    (company) => company.agent_enabled,
  ).length;
  const allVendorsMonitored =
    companies.length > 0 && monitoredVendorCount === companies.length;
  const activeRunIds = (agentStatus?.active_runs ?? [])
    .map((run) => run.scan_id)
    .sort()
    .join("|");
  const controlsLocked =
    !usesFixtureData &&
    Boolean(health?.write_protection_enabled) &&
    !operatorTokenSet;

  useEffect(() => {
    let cancelled = false;

    async function hydrateOperatorAccess() {
      if (!hasOperatorToken()) {
        setOperatorTokenSet(false);
        return;
      }

      try {
        const verified = await verifyStoredOperatorToken();
        if (!cancelled) setOperatorTokenSet(verified);
      } catch {
        if (!cancelled) setOperatorTokenSet(false);
      }
    }

    void hydrateOperatorAccess();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSeenVendorAlertKeys(readSeenVendorAlertKeys());
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      seenVendorAlertKeysStorageKey,
      JSON.stringify(seenVendorAlertKeys),
    );
  }, [seenVendorAlertKeys]);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("pulse.theme");
    const nextTheme: ThemeMode =
      storedTheme === "dark" || storedTheme === "light"
        ? storedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";

    applyThemeMode(nextTheme);
    setThemeMode(nextTheme);
    setThemeReady(true);
  }, []);

  useEffect(() => {
    if (!themeReady) return;

    applyThemeMode(themeMode);
    window.localStorage.setItem("pulse.theme", themeMode);
  }, [themeMode, themeReady]);

  useEffect(() => {
    async function loadInitialData() {
      setInitialLoading(true);
      setInitialError(null);

      try {
        const nextCompanies = await listCompanies();
        const nextAgentStatus = await getAgentStatus();
        const initialCompany = pickInitialCompany(nextCompanies);

        setCompanies(nextCompanies);
        setAgentStatus(nextAgentStatus);
        setSelectedCompanyId(initialCompany?.id ?? null);
        setWatchlistAlerts(await listLatestWatchlistAlerts(nextCompanies));
      } catch (error) {
        setInitialError(toErrorMessage(error));
      } finally {
        setInitialLoading(false);
      }
    }

    void loadInitialData();
  }, []);

  useEffect(() => {
    async function loadHealth() {
      setHealthLoading(true);
      try {
        setHealth(await getDemoHealth());
      } catch {
        setHealth(null);
      } finally {
        setHealthLoading(false);
      }
    }

    void loadHealth();
  }, []);

  useEffect(() => {
    if (!selectedCompany) return;
    const company = selectedCompany;

    async function refreshSelectedData() {
      setDetailLoading(true);
      setDetailError(null);
      setBriefLoading(Boolean(scan?.id));
      setBriefError(null);

      try {
        const nextAssessmentScan = scan ?? (await getLatestScan(company.id));
        const scanId = nextAssessmentScan?.id ?? null;
        const alertFilters = scanId
          ? { company_id: company.id, scan_id: scanId }
          : { company_id: company.id };
        const nextAlerts = await listAlerts(alertFilters);
        let nextEvidence: EvidenceItem[] = [];
        let nextTraces: BrightDataTrace[] = [];
        let nextBrief: VendorReviewBrief | null = null;
        let nextBriefError: string | null = null;

        if (scanId) {
          const [evidenceResult, tracesResult, briefResult] =
            await Promise.allSettled([
              listEvidence(company.id, scanId),
              listBrightDataTraces(scanId),
              getVendorReviewBrief(company.id, scanId),
            ]);

          nextEvidence =
            evidenceResult.status === "fulfilled" ? evidenceResult.value : [];
          nextTraces = tracesResult.status === "fulfilled" ? tracesResult.value : [];
          nextBrief = briefResult.status === "fulfilled" ? briefResult.value : null;

          const failedLoads = [evidenceResult, tracesResult]
            .filter((result) => result.status === "rejected")
            .map((result) =>
              result.status === "rejected" ? toErrorMessage(result.reason) : "",
            )
            .filter(Boolean);

          if (failedLoads.length > 0) {
            setDetailError(failedLoads.join(" "));
          }

          if (briefResult.status === "rejected" && isTerminal) {
            nextBriefError = toErrorMessage(briefResult.reason);
          }
        }

        setAlerts(nextAlerts);
        setEvidence(nextEvidence);
        setTraces(nextTraces);
        setBrief(nextBrief);
        setAssessmentScan(nextAssessmentScan);
        setBriefError(nextBriefError);
        setSelectedEvidenceId((current) =>
          current && nextEvidence.some((item) => item.id === current)
            ? current
            : nextEvidence[0]?.id ?? null,
        );
      } catch (error) {
        setAlerts([]);
        setEvidence([]);
        setTraces([]);
        setBrief(null);
        setAssessmentScan(null);
        setSelectedEvidenceId(null);
        setDetailError(toErrorMessage(error));
        setBriefError(null);
      } finally {
        setDetailLoading(false);
        setBriefLoading(false);
      }
    }

    void refreshSelectedData();
  }, [selectedCompany, scan?.id, isTerminal]);

  useEffect(() => {
    if (!isTerminal) return;

    async function refreshTerminalState() {
      const [nextCompanies, nextAgentStatus] = await Promise.all([
        listCompanies(),
        getAgentStatus(),
      ]);

      setCompanies(nextCompanies);
      setAgentStatus(nextAgentStatus);
      setWatchlistAlerts(await listLatestWatchlistAlerts(nextCompanies));
      setActiveScanId(null);
    }

    void refreshTerminalState();
  }, [isTerminal]);

  useEffect(() => {
    if (!activeRunIds) return;
    let cancelled = false;
    const scanIds = activeRunIds.split("|").filter(Boolean);

    async function advanceVisibleRuns() {
      if (scanIds.length === 0) return;

      await Promise.allSettled(scanIds.map((scanId) => getScan(scanId)));
      if (cancelled) return;

      const [nextCompanies, nextAgentStatus] = await Promise.all([
        listCompanies(),
        getAgentStatus(),
      ]);
      if (cancelled) return;

      setCompanies(nextCompanies);
      setAgentStatus(nextAgentStatus);
      setWatchlistAlerts(await listLatestWatchlistAlerts(nextCompanies));
      setActiveScanId((currentScanId) => {
        if (
          currentScanId &&
          nextAgentStatus.active_runs.some((run) => run.scan_id === currentScanId)
        ) {
          return currentScanId;
        }
        const selectedRun = nextAgentStatus.active_runs.find(
          (run) => run.company_id === selectedCompanyId,
        );
        return selectedRun?.scan_id ?? nextAgentStatus.active_runs[0]?.scan_id ?? null;
      });
    }

    void advanceVisibleRuns();
    const intervalId = window.setInterval(() => {
      void advanceVisibleRuns();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeRunIds, selectedCompanyId]);

  async function handleToggle(enabled: boolean) {
    if (!selectedCompany) return;
    setBusy(true);
    setActionError(null);

    try {
      const updatedCompany = await setVendorRiskAgent(selectedCompany.id, enabled);
      const nextAgentStatus = enabled ? await runAgentTick() : await getAgentStatus();
      const activeRun = nextAgentStatus.active_runs.find(
        (run) => run.company_id === updatedCompany.id,
      ) ?? nextAgentStatus.active_runs[0];
      const nextCompanies = companies.map((company) =>
        company.id === updatedCompany.id
          ? {
              ...updatedCompany,
              agent_status: activeRun ? "running" : updatedCompany.agent_status,
            }
          : company,
      );

      setCompanies(nextCompanies);
      setAgentStatus(nextAgentStatus);
      setActiveScanId(activeRun?.scan_id ?? null);
    } catch (error) {
      setActionError(toErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateVendor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVendorFormError(null);
    setVendorFormNotice(null);

    const validationError = validateVendorForm(vendorForm);
    if (validationError) {
      setVendorFormError(validationError);
      return;
    }

    setVendorSubmitting(true);

    try {
      const createdCompany = await createCompany({
        name: vendorForm.name,
        domain: vendorForm.domain,
        relationship_type: vendorForm.relationship_type,
        owner: vendorForm.owner,
        criticality: "normal",
        renewal_date: vendorForm.renewal_date,
        allow_list: parseSourceRules(vendorForm.allow_list_text),
        block_list: parseSourceRules(vendorForm.block_list_text),
      });
      let nextCompanies: Company[];

      try {
        nextCompanies = await listCompanies();
      } catch {
        nextCompanies = [
          ...companies.filter((company) => company.id !== createdCompany.id),
          createdCompany,
        ];
      }

      setCompanies(nextCompanies);
      saveVendorMcpServerUrl(createdCompany, vendorForm.mcp_server_url);
      setSelectedCompanyId(createdCompany.id);
      setVendorForm(emptyVendorForm);
      setVendorFormOpen(false);
      setVendorFormNotice(`${createdCompany.name} added to the watchlist.`);
    } catch (error) {
      setVendorFormError(toErrorMessage(error));
    } finally {
      setVendorSubmitting(false);
    }
  }

  async function handleDeleteVendor(company: Company) {
    const confirmed = window.confirm(
      `Delete ${company.name} and its scans, evidence, alerts, traces, and briefs?`,
    );
    if (!confirmed) return;

    setVendorDeletingId(company.id);
    setActionError(null);

    try {
      await deleteCompany(company.id);
      const nextCompanies = await listCompanies();
      const nextSelectedCompany =
        nextCompanies.find((candidate) => candidate.id !== company.id) ?? null;

      setCompanies(nextCompanies);
      setSelectedCompanyId((currentId) =>
        currentId === company.id ? nextSelectedCompany?.id ?? null : currentId,
      );
      setAgentStatus(await getAgentStatus());
      setWatchlistAlerts(await listLatestWatchlistAlerts(nextCompanies));
      if (selectedCompany?.id === company.id) {
        setAlerts([]);
        setEvidence([]);
        setTraces([]);
        setBrief(null);
        setAssessmentScan(null);
        setSelectedEvidenceId(null);
        setActiveScanId(null);
      }
    } catch (error) {
      setActionError(toErrorMessage(error));
    } finally {
      setVendorDeletingId(null);
    }
  }

  async function handleSaveSourceRules(allowList: string[], blockList: string[]) {
    if (!selectedCompany) return;
    const updatedCompany = await updateCompanySourceRules(selectedCompany.id, {
      allow_list: allowList,
      block_list: blockList,
    });
    setCompanies((currentCompanies) =>
      currentCompanies.map((company) =>
        company.id === updatedCompany.id ? updatedCompany : company,
      ),
    );
  }

  async function handleEnableWatchlist() {
    setWatchlistBusy(true);
    setActionError(null);

    try {
      const updatedCompanies = await setWatchlistRiskAgent(true);
      const nextAgentStatus = await runAgentTick();
      const runningCompanyIds = new Set(
        nextAgentStatus.active_runs.map((run) => run.company_id),
      );

      setCompanies(
        updatedCompanies.map((company) =>
          runningCompanyIds.has(company.id)
            ? { ...company, agent_status: "running" }
            : company,
        ),
      );
      setAgentStatus(nextAgentStatus);
      setActiveScanId(nextAgentStatus.active_runs[0]?.scan_id ?? null);
    } catch (error) {
      setActionError(toErrorMessage(error));
    } finally {
      setWatchlistBusy(false);
    }
  }

  if (initialLoading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center p-6">
        <CommandCenterSkeleton />
      </main>
    );
  }

  if (initialError) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center p-6">
        <StatePanel
          tone="danger"
          title="Command Center could not load"
          body={initialError}
        />
      </main>
    );
  }

  if (!selectedCompany) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center p-6">
        <StatePanel
          tone="neutral"
          title="No vendors available"
          body="The Command Center will populate after GET /api/companies returns at least one vendor."
        />
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] px-4 py-5 sm:px-6 2xl:px-8">
      <div className="mx-auto max-w-[1720px]">
        <header className="grid gap-4 border-b border-zinc-200 pb-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="good">Pulse MVP</Badge>
              <Badge tone={usesFixtureData ? "warn" : "good"}>
                {usesFixtureData ? "Fixture replay mode" : "Live API mode"}
              </Badge>
              <DemoHealthIndicator
                health={health}
                loading={healthLoading}
                fixtureMode={usesFixtureData}
              />
              {!usesFixtureData && health?.write_protection_enabled ? (
                <OperatorAccess
                  tokenSet={operatorTokenSet}
                  onTokenStateChange={setOperatorTokenSet}
                />
              ) : null}
              <button
                type="button"
                onClick={() =>
                  setThemeMode((currentTheme) =>
                    currentTheme === "dark" ? "light" : "dark",
                  )
                }
                className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-600 transition hover:border-zinc-300 active:scale-[0.97]"
                aria-label={`Switch to ${themeMode === "dark" ? "light" : "dark"} mode`}
                title={`Switch to ${themeMode === "dark" ? "light" : "dark"} mode`}
              >
                {themeMode === "dark" ? (
                  <Sun size={13} weight="bold" />
                ) : (
                  <Moon size={13} weight="bold" />
                )}
                <span>{themeMode === "dark" ? "Light" : "Dark"}</span>
              </button>
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-ink-950 sm:text-4xl">
              Autonomous vendor risk command center
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base">
              Three approved surfaces for the hackathon demo: command center,
              source-backed evidence, and a review-ready vendor brief.
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-soft">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-caution-50 text-caution-700">
                <ShieldWarning size={20} weight="duotone" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink-950">
                  Selected vendor: {selectedCompany.name}
                </p>
                <p className="mt-1 text-sm leading-6 text-zinc-600">
                  Realtime autonomous review for {selectedCompany.relationship_type}.
                  Renewal {formatDate(selectedCompany.renewal_date)}. The frontend
                  never calls Bright Data or exposes keys.
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)_minmax(500px,620px)]">
          <aside className="min-w-0 space-y-3 xl:row-span-2 2xl:row-span-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-ink-950">
                  Vendor watchlist
                </h2>
                <p className="mt-1 font-mono text-xs text-zinc-500">
                  {monitoredVendorCount} / {companies.length} monitored
                </p>
              </div>
              <button
                type="button"
                onClick={handleEnableWatchlist}
                disabled={watchlistBusy || busy || allVendorsMonitored || controlsLocked}
                title={controlsLocked ? "Operator token required" : "Enable all vendors"}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-ink-900 transition hover:border-zinc-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Power size={14} weight="bold" />
                {allVendorsMonitored ? "All on" : watchlistBusy ? "Enabling" : "Enable all"}
              </button>
            </div>
            <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink-950">
                    Add vendor
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    Exact public domain, owner, and renewal date.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={vendorFormOpen ? "Close add vendor form" : "Open add vendor form"}
                  disabled={controlsLocked}
                  title={controlsLocked ? "Operator token required" : "Add vendor"}
                  onClick={() => {
                    setVendorFormOpen((open) => !open);
                    setVendorFormError(null);
                    setVendorFormNotice(null);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition hover:border-zinc-300 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {vendorFormOpen ? <X size={16} /> : <Plus size={16} />}
                </button>
              </div>

              {vendorFormNotice && !vendorFormOpen ? (
                <p className="mt-3 rounded-md border border-signal-100 bg-signal-50 px-3 py-2 text-xs text-signal-700">
                  {vendorFormNotice}
                </p>
              ) : null}

              {vendorFormOpen ? (
                <form className="mt-4 space-y-3" onSubmit={handleCreateVendor}>
                  <VendorTextField
                    id="vendor-name"
                    label="Vendor name"
                    value={vendorForm.name}
                    placeholder="Akamai"
                    onChange={(value) =>
                      setVendorForm((form) => ({ ...form, name: value }))
                    }
                  />
                  <VendorTextField
                    id="vendor-domain"
                    label="Exact domain"
                    value={vendorForm.domain}
                    placeholder="akamai.com"
                    onChange={(value) =>
                      setVendorForm((form) => ({ ...form, domain: value }))
                    }
                  />
                  <VendorTextField
                    id="vendor-relationship"
                    label="Relationship type"
                    value={vendorForm.relationship_type}
                    placeholder="edge security"
                    onChange={(value) =>
                      setVendorForm((form) => ({
                        ...form,
                        relationship_type: value,
                      }))
                    }
                  />
                  <VendorTextField
                    id="vendor-owner"
                    label="Owner"
                    value={vendorForm.owner}
                    placeholder="Security"
                    onChange={(value) =>
                      setVendorForm((form) => ({ ...form, owner: value }))
                    }
                  />
                  <label className="block text-xs font-medium text-zinc-600">
                    Renewal date
                    <input
                      type="date"
                      value={vendorForm.renewal_date}
                      onChange={(event) =>
                        setVendorForm((form) => ({
                          ...form,
                          renewal_date: event.target.value,
                        }))
                      }
                      className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-ink-950 outline-none transition focus:border-ink-900 focus:ring-2 focus:ring-ink-900/10"
                    />
                  </label>
                  <VendorTextField
                    id="vendor-mcp-server"
                    label="Vendor MCP server (optional)"
                    value={vendorForm.mcp_server_url}
                    placeholder="https://mcp.vendor.com/mcp"
                    onChange={(value) =>
                      setVendorForm((form) => ({
                        ...form,
                        mcp_server_url: value,
                      }))
                    }
                  />
                  <VendorTextArea
                    id="vendor-allow-list"
                    label="Allowed sources"
                    value={vendorForm.allow_list_text}
                    placeholder="trust.vendor.com, vendor.com/security"
                    onChange={(value) =>
                      setVendorForm((form) => ({
                        ...form,
                        allow_list_text: value,
                      }))
                    }
                  />
                  <VendorTextArea
                    id="vendor-block-list"
                    label="Blocked sources"
                    value={vendorForm.block_list_text}
                    placeholder="careers.vendor.com, community.vendor.com"
                    onChange={(value) =>
                      setVendorForm((form) => ({
                        ...form,
                        block_list_text: value,
                      }))
                    }
                  />
                  <p className="text-xs leading-5 text-zinc-500">
                    Source rules are optional. Separate hosts or public paths with
                    commas or new lines.
                  </p>

                  {vendorFormError ? (
                    <p className="rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
                      {vendorFormError}
                    </p>
                  ) : null}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setVendorForm(emptyVendorForm);
                        setVendorFormError(null);
                        setVendorFormOpen(false);
                      }}
                      className="inline-flex h-9 items-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-600 transition hover:border-zinc-300 active:scale-[0.98]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={vendorSubmitting}
                      className="inline-flex h-9 items-center rounded-md bg-ink-950 px-3 text-xs font-semibold text-white transition hover:bg-ink-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {vendorSubmitting ? "Adding..." : "Add vendor"}
                    </button>
                  </div>
                </form>
              ) : null}
            </section>
            {sortedCompanies.map((company) => {
              const companyAlerts = getVendorAlerts(watchlistAlerts, company.id);
              const hasNewFinding = hasUnreadVendorAlert(
                company,
                watchlistAlerts,
                seenVendorAlertKeys,
              );

              return (
              <VendorCard
                key={company.id}
                company={company}
                alerts={companyAlerts}
                hasNewFinding={hasNewFinding}
                findingCount={companyAlerts.length}
                selected={company.id === selectedCompany.id}
                onSelect={() => {
                  markVendorAlertsSeen(
                    company,
                    watchlistAlerts,
                    setSeenVendorAlertKeys,
                  );
                  setSelectedCompanyId(company.id);
                }}
                onDelete={() => void handleDeleteVendor(company)}
                deleteDisabled={controlsLocked || vendorDeletingId === company.id}
              />
              );
            })}
          </aside>

          <section className="min-w-0 space-y-5">
            <div className="grid gap-4 min-[1440px]:grid-cols-[1fr_1fr]">
              <AgentToggle
                company={selectedCompany}
                busy={busy || watchlistBusy || controlsLocked}
                locked={controlsLocked}
                onToggle={handleToggle}
              />
              <AgentStatusPanel
                company={selectedCompany}
                agentStatus={agentStatus}
                scan={scan}
                traces={traces}
              />
            </div>
            <SourceRulesPanel
              key={selectedCompany.id}
              company={selectedCompany}
              locked={controlsLocked}
              onSave={handleSaveSourceRules}
            />
            {actionError ? (
              <StatePanel
                tone="danger"
                title="Agent action failed"
                body={actionError}
              />
            ) : null}
            <ReviewStatusStrip
              scan={displayScan}
              traces={traces}
              pollingError={pollingError}
            />

            <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-ink-950">
                    Verified alert strip
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    Unsupported evidence remains visible but does not create a
                    high-priority alert.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="inline-flex items-center gap-2 rounded-md bg-ink-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-ink-800 active:scale-[0.98]"
                >
                  Open Source Explorer
                  <ArrowRight size={15} weight="bold" />
                </button>
              </div>

              <div className="mt-4 grid gap-3 min-[1440px]:grid-cols-[1fr_1fr]">
                {detailLoading ? (
                  <AlertSkeleton />
                ) : detailError ? (
                  <StatePanel
                    tone="danger"
                    title="Alerts unavailable"
                    body={detailError}
                  />
                ) : selectedAlerts.length === 0 ? (
                  <StatePanel
                    tone="neutral"
                    title="No new scored alert in this scan"
                    body="Pulse verified evidence for the brief, but the latest findings matched known evidence. Use Source Explorer to inspect the verified rows."
                  />
                ) : (
                  selectedAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Badge tone={alert.severity === "high" ? "warn" : "neutral"}>
                        {alert.alert_type === "related_change"
                          ? "related change"
                          : "verified signal"}
                      </Badge>
                      <span className="font-mono text-sm font-semibold text-ink-950">
                        {alert.score}
                      </span>
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-ink-950">
                      {alert.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">
                      {alert.summary}
                    </p>
                    <div className="mt-3 border-t border-zinc-200 pt-3">
                      <p className="text-xs text-zinc-500">
                        Suggested owner: {alert.owner}.
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const relatedIds = alert.related_evidence_ids;
                            setSelectedEvidenceId(
                              alert.evidence_item_id ?? relatedIds[0] ?? null,
                            );
                            setDrawerOpen(true);
                          }}
                          className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-ink-900 transition hover:border-zinc-300 active:scale-[0.98]"
                        >
                          Review evidence
                          <ArrowRight size={14} weight="bold" />
                        </button>
                      </div>
                    </div>
                  </div>
                  ))
                )}
              </div>
            </section>
          </section>

          <div className="min-w-0 xl:col-start-2 2xl:col-start-auto">
            <RiskAssessmentBrief
              brief={brief}
              scan={displayScan}
              traces={traces}
              loading={briefLoading}
              error={briefError}
              companyName={selectedCompany.name}
              evidence={evidence}
              onRequestHtml={() =>
                brief
                  ? getVendorReviewBrief(brief.company_id, brief.scan_id, "html")
                  : Promise.reject(new Error("A completed brief is required for HTML export."))
              }
            />
          </div>
        </div>
      </div>

      <EvidenceDrawer
        open={drawerOpen}
        alerts={selectedAlerts}
        evidence={evidence}
        traces={traces}
        selectedEvidenceId={selectedEvidenceId}
        loading={detailLoading}
        error={detailError}
        onSelectEvidence={setSelectedEvidenceId}
        onClose={() => setDrawerOpen(false)}
      />
    </main>
  );
}

function CommandCenterSkeleton() {
  return (
    <div className="w-full max-w-5xl rounded-lg border border-zinc-200 bg-white p-6 shadow-soft">
      <div className="h-6 w-28 animate-pulse rounded-full bg-zinc-100" />
      <div className="mt-5 h-9 w-3/5 animate-pulse rounded bg-zinc-100" />
      <div className="mt-3 h-4 w-4/5 animate-pulse rounded bg-zinc-100" />
      <div className="mt-8 grid gap-3 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-lg border border-zinc-200 p-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-100" />
            <div className="mt-4 h-16 animate-pulse rounded bg-zinc-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertSkeleton() {
  return (
    <>
      {[0, 1].map((item) => (
        <div key={item} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <div className="h-6 w-32 animate-pulse rounded-full bg-zinc-100" />
          <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-zinc-100" />
          <div className="mt-3 h-4 w-full animate-pulse rounded bg-zinc-100" />
        </div>
      ))}
    </>
  );
}

function VendorTextField({
  id,
  label,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="block text-xs font-medium text-zinc-600">
      {label}
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-ink-950 outline-none transition placeholder:text-zinc-400 focus:border-ink-900 focus:ring-2 focus:ring-ink-900/10"
      />
    </label>
  );
}

function VendorTextArea({
  id,
  label,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="block text-xs font-medium text-zinc-600">
      {label}
      <textarea
        id={id}
        value={value}
        rows={2}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-20 w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-ink-950 outline-none transition placeholder:text-zinc-400 focus:border-ink-900 focus:ring-2 focus:ring-ink-900/10"
      />
    </label>
  );
}

function StatePanel({
  tone,
  title,
  body,
}: {
  tone: "neutral" | "danger";
  title: string;
  body: string;
}) {
  return (
    <div
      className={`rounded-lg border p-4 text-sm ${
        tone === "danger"
          ? "border-rose-100 bg-rose-50 text-rose-700"
          : "border-dashed border-zinc-300 bg-white text-zinc-500"
      }`}
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1 leading-6">{body}</p>
    </div>
  );
}

function toErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Pulse API returned an unexpected error.";
}

function validateVendorForm(form: VendorFormState) {
  if (!form.name.trim()) return "Vendor name is required.";
  if (!form.domain.trim()) return "Exact domain is required.";
  if (!form.relationship_type.trim()) return "Relationship type is required.";
  if (!form.owner.trim()) return "Owner is required.";
  if (!form.renewal_date) return "Renewal date is required.";

  const domain = form.domain.trim().toLowerCase();
  if (domain.includes("://") || domain.includes("/") || !domain.includes(".")) {
    return "Use an exact host such as vendor.com, without protocol or path.";
  }

  if (Number.isNaN(new Date(`${form.renewal_date}T00:00:00`).getTime())) {
    return "Renewal date must be a valid date.";
  }
  if (form.mcp_server_url.trim() && !isValidHttpUrl(form.mcp_server_url)) {
    return "Vendor MCP server must be a valid http or https URL.";
  }

  return null;
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function parseSourceRules(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function pickInitialCompany(companies: Company[]) {
  return (
    companies.find((company) => company.name.toLowerCase().includes("cloudflare")) ??
    [...companies].sort((a, b) => a.name.localeCompare(b.name))[0] ??
    null
  );
}

function getVendorAttentionRank(
  company: Company,
  alerts: Alert[],
  seenVendorAlertKeys: SeenVendorAlertKeys,
) {
  const unreadAlertCount = getUnreadVendorAlerts(
    company,
    alerts,
    seenVendorAlertKeys,
  ).length;

  if (unreadAlertCount > 0) {
    return 2000 + unreadAlertCount;
  }

  if (company.agent_status === "running") return 500;
  if (company.agent_enabled) return 100;

  return 0;
}

function getVendorAlerts(alerts: Alert[], companyId: string) {
  return alerts
    .filter((alert) => alert.company_id === companyId)
    .sort(
      (firstAlert, secondAlert) =>
        new Date(secondAlert.created_at).getTime() -
        new Date(firstAlert.created_at).getTime(),
    );
}

function getUnreadVendorAlerts(
  company: Company,
  alerts: Alert[],
  seenVendorAlertKeys: SeenVendorAlertKeys,
) {
  const seenAlertKeys = new Set(seenVendorAlertKeys[company.id] ?? []);

  return getVendorAlerts(alerts, company.id).filter(
    (alert) =>
      !seenAlertKeys.has(alert.id) &&
      !seenAlertKeys.has(getVendorAlertFingerprint(alert)),
  );
}

function hasUnreadVendorAlert(
  company: Company,
  alerts: Alert[],
  seenVendorAlertKeys: SeenVendorAlertKeys,
) {
  return getUnreadVendorAlerts(company, alerts, seenVendorAlertKeys).length > 0;
}

function markVendorAlertsSeen(
  company: Company,
  alerts: Alert[],
  setSeenVendorAlertKeys: Dispatch<SetStateAction<SeenVendorAlertKeys>>,
) {
  const alertKeys = getVendorAlerts(alerts, company.id).flatMap((alert) => [
    alert.id,
    getVendorAlertFingerprint(alert),
  ]);
  if (alertKeys.length === 0) return;

  setSeenVendorAlertKeys((currentSeenAlertKeys) => {
    const mergedKeys = new Set([
      ...(currentSeenAlertKeys[company.id] ?? []),
      ...alertKeys,
    ]);

    return {
      ...currentSeenAlertKeys,
      [company.id]: Array.from(mergedKeys).slice(-100),
    };
  });
}

function getVendorAlertFingerprint(alert: Alert) {
  return [
    "finding",
    alert.alert_type,
    normalizeFingerprintText(alert.title),
    normalizeFingerprintText(alert.summary),
    normalizeFingerprintText(alert.recommended_action),
  ].join(":");
}

function normalizeFingerprintText(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s:/.-]/gu, "")
    .trim();
}

function readSeenVendorAlertKeys(): SeenVendorAlertKeys {
  try {
    const storedValue =
      window.localStorage.getItem(seenVendorAlertKeysStorageKey) ??
      window.localStorage.getItem(legacySeenVendorAlertIdsStorageKey);
    if (!storedValue) return {};

    const parsedValue: unknown = JSON.parse(storedValue);
    if (!parsedValue || typeof parsedValue !== "object") return {};

    return Object.fromEntries(
      Object.entries(parsedValue)
        .filter((entry): entry is [string, unknown[]] => Array.isArray(entry[1]))
        .map(([companyId, alertIds]) => [
          companyId,
          alertIds.filter((alertId): alertId is string => typeof alertId === "string"),
        ]),
    );
  } catch {
    return {};
  }
}

function applyThemeMode(themeMode: ThemeMode) {
  document.documentElement.dataset.theme = themeMode;
  document.documentElement.style.colorScheme = themeMode;
}

async function listLatestWatchlistAlerts(companies: Company[]) {
  const latestAlerts = await Promise.all(
    companies.map(async (company) => {
      try {
        return listAlerts({ company_id: company.id });
      } catch {
        return [];
      }
    }),
  );

  return latestAlerts.flat();
}

