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
  ArrowLeft,
  ArrowRight,
  CalendarBlank,
  CaretDown,
  Check,
  Clock,
  LinkSimple,
  Plus,
  Power,
  Pulse,
  SealCheck,
  ShieldCheck,
  Target,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { VendorLogo, Wordmark } from "@/components/landing/icons";
import { AlertChannelsPanel } from "@/components/AlertChannelsPanel";
import { Badge } from "@/components/Badge";
import { DemoHealthIndicator } from "@/components/DemoHealthIndicator";
import { EvidenceDrawer } from "@/components/EvidenceDrawer";
import { OperatorAccess } from "@/components/OperatorAccess";
import { RiskAssessmentBrief } from "@/components/RiskAssessmentBrief";
import { SourceRulesPanel } from "@/components/SourceRulesPanel";
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
import { summarizeSourceModes } from "@/lib/sourceModes";
import { getVendorMcpServerUrl, saveVendorMcpServerUrl } from "@/lib/vendorMcp";
import type {
  AgentStatusResponse,
  Alert,
  BrightDataTrace,
  Company,
  EvidenceItem,
  HealthResponse,
  ScanStatusResponse,
  StageStatus,
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
const dashboardStageLabels = ["Collect", "Extract", "Verify", "Score", "Brief"];

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
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
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
    // Pulse's Sekreativ brand is dark-first: default to dark unless the
    // operator has explicitly chosen light via the in-app toggle.
    const nextTheme: ThemeMode =
      storedTheme === "dark" || storedTheme === "light" ? storedTheme : "dark";

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
    <main className="demo-app">
      <header className="topbar">
        <div className="topbar__l">
          <a href="/" aria-label="Pulse home" className="inline-flex items-center">
            <Wordmark size={28} />
          </a>
          <span className="topbar__crumb">
            <span>/</span>
            <b>Command Center</b>
          </span>
        </div>
        <div className="topbar__r">
          <div className="topbar__badges">
            <span className="ccbadge">Pulse MVP</span>
            <span className="ccbadge ccbadge--live">
              <span className="livedot" style={{ width: 6, height: 6 }} />
              {usesFixtureData ? "Fixture replay" : "Live API mode"}
            </span>
            <DemoHealthIndicator
              health={health}
              loading={healthLoading}
              fixtureMode={usesFixtureData}
            />
          </div>
          {!usesFixtureData && health?.write_protection_enabled ? (
            <OperatorAccess
              tokenSet={operatorTokenSet}
              onTokenStateChange={setOperatorTokenSet}
            />
          ) : null}
          <a href="/" className="topbar__back">
            <ArrowLeft size={15} /> Back to site
          </a>
        </div>
      </header>

      <div className="deck">
        <aside className="col col--sticky">
          <section className="dpanel wl">
            <div className="dpanel__h">
              <div>
                <h3>Vendor watchlist</h3>
                <p className="mono mt-1 text-xs text-zinc-500">
                  {monitoredVendorCount} / {companies.length} monitored
                </p>
              </div>
              <button
                type="button"
                onClick={handleEnableWatchlist}
                disabled={watchlistBusy || busy || allVendorsMonitored || controlsLocked}
                title={controlsLocked ? "Operator token required" : "Enable all vendors"}
                className="ccbadge"
              >
                <Power size={13} weight="bold" />
                {allVendorsMonitored ? "All on" : watchlistBusy ? "Enabling" : "All on"}
              </button>
            </div>

            <button
              type="button"
              className="wl__add"
              disabled={controlsLocked}
              title={controlsLocked ? "Operator token required" : "Add vendor"}
              onClick={() => {
                setVendorFormOpen((open) => !open);
                setVendorFormError(null);
                setVendorFormNotice(null);
              }}
            >
              <span className="wl__addic">
                {vendorFormOpen ? <X size={16} /> : <Plus size={16} />}
              </span>
              <span>
                <b>Add vendor</b>
                <span>Exact domain, owner, renewal date</span>
              </span>
            </button>

            {vendorFormNotice && !vendorFormOpen ? (
              <p className="rounded-md border border-signal-100 bg-signal-50 px-3 py-2 text-xs text-signal-700">
                {vendorFormNotice}
              </p>
            ) : null}

            {vendorFormOpen ? (
              <form className="grid gap-3" onSubmit={handleCreateVendor}>
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
                <label className="addv__field text-xs font-medium text-zinc-600">
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
                    className="opinput"
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
                  <p className="operr">{vendorFormError}</p>
                ) : null}
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVendorForm(emptyVendorForm);
                      setVendorFormError(null);
                      setVendorFormOpen(false);
                    }}
                    className="ccbadge"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={vendorSubmitting}
                    className="ccbadge ccbadge--live disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {vendorSubmitting ? "Adding" : "Add vendor"}
                  </button>
                </div>
              </form>
            ) : null}

            {sortedCompanies.map((company) => {
              const companyAlerts = getVendorAlerts(watchlistAlerts, company.id);
              const hasNewFinding = hasUnreadVendorAlert(
                company,
                watchlistAlerts,
                seenVendorAlertKeys,
              );

              return (
                <DashboardVendorCard
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
          </section>
        </aside>

        <section className="col">
          <SelectedVendorPanel company={selectedCompany} alerts={selectedAlerts} />

          <section className="dpanel">
            <DesignerAgentPanel
              company={selectedCompany}
              busy={busy || watchlistBusy || controlsLocked}
              locked={controlsLocked}
              scan={displayScan}
              traces={traces}
              pollingError={pollingError}
              onToggle={handleToggle}
            />
          </section>

          {actionError ? (
            <StatePanel
              tone="danger"
              title="Agent action failed"
              body={actionError}
            />
          ) : null}

          <section className="dpanel">
            <div className="dpanel__h">
              <h3>Verified alerts</h3>
              <span className="mono text-xs text-zinc-500">
                {selectedAlerts.length} signals
              </span>
            </div>
            <DashboardAlerts
              alerts={selectedAlerts}
              loading={detailLoading}
              error={detailError}
              onOpenExplorer={(evidenceId) => {
                setSelectedEvidenceId(evidenceId);
                setDrawerOpen(true);
              }}
            />
          </section>

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
        </section>

        <aside className="col col--sticky">
          <section className="dpanel">
            <DashboardAgentStatus
              company={selectedCompany}
              agentStatus={agentStatus}
              scan={displayScan}
              traces={traces}
            />
          </section>

          <section className="dpanel">
            <AlertChannelsPanel locked={controlsLocked} />
          </section>

          <SourceRulesPanel
            key={selectedCompany.id}
            company={selectedCompany}
            locked={controlsLocked}
            onSave={handleSaveSourceRules}
          />
        </aside>
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

function DashboardVendorCard({
  company,
  alerts,
  hasNewFinding,
  findingCount,
  selected,
  onSelect,
  onDelete,
  deleteDisabled,
}: {
  company: Company;
  alerts: Alert[];
  hasNewFinding: boolean;
  findingCount: number;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  deleteDisabled: boolean;
}) {
  const [mcpExpanded, setMcpExpanded] = useState(false);
  const topAlert = alerts.find((alert) => alert.company_id === company.id);
  const alertState = getDashboardVendorAlertState(
    company,
    hasNewFinding,
    findingCount,
  );
  const mcpServerUrl = getVendorMcpServerUrl(company);

  return (
    <article
      className={`rounded-lg border p-4 transition ${
        selected
          ? "border-signal-600 bg-white/[0.04]"
          : "border-zinc-200 bg-white/[0.02] hover:border-zinc-300"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
          <div className="flex min-w-0 items-center gap-3">
            <VendorLogo domain={company.domain} size={24} />
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-ink-950">
                {company.name}
              </h3>
              <p className="mono mt-1 truncate text-xs text-zinc-500">
                {company.domain}
              </p>
            </div>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`alertpill ${alertState.className}`} title={alertState.title}>
            {alertState.label}
          </span>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleteDisabled}
            title={deleteDisabled ? "Operator token required" : `Delete ${company.name}`}
            aria-label={`Delete ${company.name}`}
            className="grid h-8 w-8 place-items-center rounded-md border border-zinc-200 text-zinc-500 transition hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X size={14} weight="bold" />
          </button>
        </div>
      </div>

      <button type="button" onClick={onSelect} className="mt-4 w-full text-left">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="dlabel">Owner</p>
            <p className="mt-2 text-sm font-semibold text-ink-950">{company.owner}</p>
          </div>
          <div>
            <p className="dlabel">Latest score</p>
            <p className="mono mt-2 text-sm font-semibold text-ink-950">
              {topAlert ? `${topAlert.score} (${getScorePriorityLabel(topAlert.score)})` : "no new"}
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 border-t border-zinc-100 pt-4 text-sm text-zinc-600">
          <CalendarBlank size={15} />
          <span>Renewal {formatDate(company.renewal_date)}</span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => {
          if (mcpServerUrl) setMcpExpanded((current) => !current);
        }}
        className="mt-3 flex w-full min-w-0 items-center gap-2 rounded-md border border-zinc-200 bg-white/[0.02] px-3 py-2 text-left text-sm text-zinc-600 transition hover:border-zinc-300"
        aria-expanded={mcpServerUrl ? mcpExpanded : undefined}
      >
        <span
          className={
            mcpServerUrl
              ? "livedot shrink-0"
              : "h-2.5 w-2.5 shrink-0 rounded-full bg-rose-600"
          }
          style={mcpServerUrl ? { width: 10, height: 10 } : undefined}
        />
        <span className="min-w-0 flex-1 truncate">
          {mcpServerUrl ? "MCP server connected" : "No MCP server configured"}
        </span>
        {mcpServerUrl ? (
          <CaretDown
            size={14}
            className={`shrink-0 transition ${mcpExpanded ? "rotate-180" : ""}`}
          />
        ) : null}
      </button>
      {mcpServerUrl && mcpExpanded ? (
        <div className="mt-2 flex min-w-0 items-center gap-2 rounded-md border border-zinc-100 bg-black/20 px-3 py-2 text-zinc-500">
          <LinkSimple size={13} className="shrink-0" />
          <span className="mono truncate text-xs">{mcpServerUrl}</span>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-4">
        <span className="inline-flex items-center gap-2 text-sm text-zinc-600">
          <Pulse
            size={14}
            weight={company.agent_enabled ? "fill" : "regular"}
            className={company.agent_enabled ? "text-signal-600" : "text-zinc-400"}
          />
          {labelize(company.agent_status)}
        </span>
        <span className="text-sm font-semibold text-ink-950">
          {topAlert ? (hasNewFinding ? "New finding" : "Reviewed") : "No alert"}
        </span>
      </div>
    </article>
  );
}

function SelectedVendorPanel({
  company,
  alerts,
}: {
  company: Company;
  alerts: Alert[];
}) {
  const topAlert = alerts[0];

  return (
    <section className="dpanel">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-zinc-200 bg-white/[0.04]">
            <VendorLogo domain={company.domain} size={30} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-bold tracking-tight text-ink-950">
              {company.name}
            </h2>
            <p className="mono mt-1 truncate text-sm text-zinc-500">
              {company.domain} · {company.relationship_type}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="mono text-xs uppercase tracking-[0.16em] text-zinc-500">
            {topAlert ? `${topAlert.score} scored finding` : "No scored finding yet"}
          </p>
          <p className="mono mt-2 text-sm uppercase tracking-[0.16em] text-zinc-500">
            Renews {formatDate(company.renewal_date)}
          </p>
        </div>
      </div>
    </section>
  );
}

function DesignerAgentPanel({
  company,
  busy,
  locked,
  scan,
  traces,
  pollingError,
  onToggle,
}: {
  company: Company;
  busy: boolean;
  locked: boolean;
  scan: ScanStatusResponse | null;
  traces: BrightDataTrace[];
  pollingError: string | null;
  onToggle: (enabled: boolean) => void;
}) {
  const sourceSummary = summarizeSourceModes(traces, scan?.mode);
  const stages =
    scan?.stages ??
    dashboardStageLabels.map((label) => ({
      name: label.toLowerCase(),
      status: "pending" as StageStatus,
    }));

  return (
    <>
      <div className="agenthead">
        <div className="agenthead__t">
          <ShieldCheck size={19} weight="duotone" className="text-caution-700" />
          <div>
            <b>Vendor Risk Agent</b>
            <p className="agentdesc">
              Autonomous monitoring for public vendor-risk evidence. Collection and
              credentials stay server-side.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggle(!company.agent_enabled)}
          className={`toggle ${company.agent_enabled ? "toggle--on" : ""}`}
          aria-pressed={company.agent_enabled}
          aria-label="Toggle Vendor Risk Agent"
          title={locked ? "Operator token required" : "Toggle Vendor Risk Agent"}
        >
          <Power size={13} />
          <span className="toggle__knob" />
        </button>
      </div>

      <div className="cycle mt-6 border-t border-zinc-100 pt-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="dlabel">Autonomous review cycle</p>
          <span className="ccbadge ccbadge--lock">
            {scan?.status === "running" ? "Running now" : company.agent_enabled ? "Due now" : "Paused"}
          </span>
        </div>
        <div className="cyclebar">
          {stages.map((stage, index) => (
            <div
              key={stage.name}
              className={`cstage ${
                stage.status === "running"
                  ? "cstage--active"
                  : stage.status === "completed"
                    ? "cstage--done"
                    : ""
              }`}
            >
              <div className="cstage__top">
                <span className="cstage__name">{dashboardStageLabels[index]}</span>
                <StageIcon status={stage.status} />
              </div>
              <div className="cstage__bar">
                <span
                  className="cstage__fill"
                  style={{
                    width:
                      stage.status === "completed"
                        ? "100%"
                        : stage.status === "running"
                          ? "74%"
                          : "0%",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="cycle__status">
          <span className="livedot" style={{ width: 8, height: 8 }} />
          <span>{scan ? sourceSummary.detail : "Waiting for the next realtime review."}</span>
          <span className="mono ml-auto">polling /api/scans every 2s</span>
        </div>
      </div>

      <DashboardTraceStream traces={traces} scan={scan} />

      {pollingError ? (
        <p className="operr mt-4">
          <WarningCircle size={15} /> {pollingError}
        </p>
      ) : null}
    </>
  );
}

function DashboardTraceStream({
  traces,
  scan,
}: {
  traces: BrightDataTrace[];
  scan: ScanStatusResponse | null;
}) {
  return (
    <div className="traces">
      <div className="traces__h">
        <span className="dlabel">Bright Data trace</span>
        <span className="mono text-xs text-zinc-500">{traces.length} ops</span>
      </div>
      {traces.length === 0 ? (
        <div className="p-4 text-sm text-zinc-500">
          {scan ? "Trace rows will appear as collection completes." : "No scan selected yet."}
        </div>
      ) : (
        traces.slice(0, 6).map((trace) => (
          <div key={trace.id} className="trace">
            <span className="trace__op">{trace.operation || trace.product}</span>
            <span className="trace__url">{trace.source_url ?? "internal operation"}</span>
            <span
              className={`mono ${
                trace.status.startsWith("2") ? "text-signal-700" : "text-caution-700"
              }`}
            >
              {trace.status}
            </span>
            <span className="trace__lat">
              {trace.latency_ms === null
                ? "-"
                : trace.latency_ms >= 1000
                  ? `${(trace.latency_ms / 1000).toFixed(1)}s`
                  : `${trace.latency_ms}ms`}
            </span>
            <span className={`srcmode srcmode--${trace.source_mode}`}>
              {trace.source_mode}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

function DashboardAlerts({
  alerts,
  loading,
  error,
  onOpenExplorer,
}: {
  alerts: Alert[];
  loading: boolean;
  error: string | null;
  onOpenExplorer: (evidenceId: string | null) => void;
}) {
  if (loading) return <AlertSkeleton />;
  if (error) {
    return <StatePanel tone="danger" title="Alerts unavailable" body={error} />;
  }
  if (alerts.length === 0) {
    return (
      <StatePanel
        tone="neutral"
        title="No new scored alert in this scan"
        body="Pulse verified evidence for the brief. Open Source Explorer to inspect the verified rows."
      />
    );
  }

  return (
    <div className="alerts">
      {alerts.map((alert) => (
        <button
          key={alert.id}
          type="button"
          className={`alert ${alert.severity === "high" ? "alert--high" : "alert--med"}`}
          onClick={() =>
            onOpenExplorer(alert.evidence_item_id ?? alert.related_evidence_ids[0] ?? null)
          }
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-zinc-200">
            <WarningCircle size={18} />
          </span>
          <span className="alert__body">
            <span className="alert__title">{alert.title}</span>
            <span className="alert__meta">
              <span>{alert.owner}</span>
              <span>·</span>
              <span>{labelize(alert.severity)}</span>
              <span>·</span>
              <span className="mono">{alert.score}</span>
            </span>
          </span>
          <ArrowRight size={16} className="alert__chev" />
        </button>
      ))}
    </div>
  );
}

function DashboardAgentStatus({
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
  const sourceSummary = summarizeSourceModes(traces, scan?.mode);
  const activeRun = agentStatus?.active_runs.find(
    (run) => run.company_id === company.id,
  );
  const currentActivity = scan
    ? scan.status === "failed"
      ? "Review failed, evidence preserved"
      : scan.status === "running"
        ? `Investigating public sources: ${labelize(scan.current_stage)}`
        : `Review complete: ${sourceSummary.label}`
    : company.agent_enabled
      ? "Watching public sources for vendor-risk signals"
      : "Inactive";
  const nextSweepLabel = scan
    ? scan.status === "running"
      ? "Scanning now"
      : "Continuous watch"
    : company.agent_enabled && isDueNow(company.next_agent_run_at)
      ? "Scanning now"
      : company.agent_enabled
        ? "Continuous watch"
        : "Not armed";

  return (
    <>
      <div className="dpanel__h">
        <h3>Agent status</h3>
        <Badge tone={company.agent_enabled ? "good" : "neutral"}>
          {company.agent_enabled ? "Autonomous" : "Off"}
        </Badge>
      </div>
      <div className="statlist">
        <StatusRow
          icon={<Target size={17} />}
          label="Review policy"
          value={company.agent_enabled ? "Realtime monitoring" : "Realtime ready"}
        />
        <StatusRow icon={<Clock size={17} />} label="Next sweep" value={nextSweepLabel} />
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
    </>
  );
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
    <div className="statrow">
      {icon}
      <div className="min-w-0">
        <p className="fine">{label}</p>
        <b>{value}</b>
      </div>
    </div>
  );
}

function StageIcon({ status }: { status: StageStatus }) {
  if (status === "completed") {
    return <Check size={15} weight="bold" className="cstage__ic" />;
  }

  if (status === "failed") {
    return <WarningCircle size={15} weight="bold" className="cstage__ic" />;
  }

  return <Clock size={15} className="cstage__ic" />;
}

function isDueNow(value: string | null) {
  if (!value) return false;
  return new Date(value).getTime() <= Date.now();
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
    <label htmlFor={id} className="addv__field text-xs font-medium text-zinc-600">
      {label}
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="opinput"
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
    <label htmlFor={id} className="addv__field text-xs font-medium text-zinc-600">
      {label}
      <textarea
        id={id}
        value={value}
        rows={2}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="opinput min-h-20 resize-y"
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

function getScorePriorityLabel(score: number) {
  if (score >= 80) return "Urgent";
  if (score >= 60) return "High";
  if (score >= 30) return "Medium";
  return "Low";
}

function getDashboardVendorAlertState(
  company: Company,
  hasNewFinding: boolean,
  findingCount: number,
) {
  if (hasNewFinding) {
    return {
      label: findingCount > 1 ? `${findingCount} new` : "New alert",
      title: `Pulse found new verified evidence for ${company.name}.`,
      className: "alertpill--new",
    };
  }

  if (company.agent_status === "running") {
    return {
      label: "Scanning",
      title: `${company.name} is currently being reviewed.`,
      className: "alertpill--scan",
    };
  }

  return {
    label: "No alert",
    title: `${company.name} has no unread finding.`,
    className: "alertpill--none",
  };
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

