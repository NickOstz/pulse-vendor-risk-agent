"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle,
  Plus,
  Power,
  Prohibit,
  ShieldWarning,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { AgentStatusPanel } from "@/components/AgentStatusPanel";
import { AgentToggle } from "@/components/AgentToggle";
import { Badge } from "@/components/Badge";
import { DemoHealthIndicator } from "@/components/DemoHealthIndicator";
import { EvidenceDrawer } from "@/components/EvidenceDrawer";
import { ReviewStatusStrip } from "@/components/ReviewStatusStrip";
import { RiskAssessmentBrief } from "@/components/RiskAssessmentBrief";
import { SourceRulesPanel } from "@/components/SourceRulesPanel";
import { VendorCard } from "@/components/VendorCard";
import { useScanPolling } from "@/hooks/useScanPolling";
import {
  createCompany,
  getAgentStatus,
  getDemoHealth,
  getVendorReviewBrief,
  listAlerts,
  listBrightDataTraces,
  listCompanies,
  listEvidence,
  runAgentTick,
  setVendorRiskAgent,
  setWatchlistRiskAgent,
  updateCompanySourceRules,
  updateAlertReviewStatus,
  usesFixtureData,
} from "@/lib/api";
import { formatDate, labelize } from "@/lib/formatters";
import type {
  AgentStatusResponse,
  Alert,
  AlertReviewStatus,
  BrightDataTrace,
  Company,
  Criticality,
  EvidenceItem,
  HealthResponse,
  VendorReviewBrief,
} from "@/lib/types";

type VendorFormState = {
  name: string;
  domain: string;
  relationship_type: string;
  owner: string;
  criticality: Criticality;
  renewal_date: string;
  allow_list_text: string;
  block_list_text: string;
};

const emptyVendorForm: VendorFormState = {
  name: "",
  domain: "",
  relationship_type: "",
  owner: "",
  criticality: "important",
  renewal_date: "",
  allow_list_text: "",
  block_list_text: "",
};

export function CommandCenter() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    null,
  );
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [traces, setTraces] = useState<BrightDataTrace[]>([]);
  const [brief, setBrief] = useState<VendorReviewBrief | null>(null);
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
  const [alertReviewError, setAlertReviewError] = useState<string | null>(null);
  const [alertReviewPendingId, setAlertReviewPendingId] = useState<string | null>(
    null,
  );
  const [vendorFormOpen, setVendorFormOpen] = useState(false);
  const [vendorForm, setVendorForm] =
    useState<VendorFormState>(emptyVendorForm);
  const [vendorSubmitting, setVendorSubmitting] = useState(false);
  const [vendorFormError, setVendorFormError] = useState<string | null>(null);
  const [vendorFormNotice, setVendorFormNotice] = useState<string | null>(null);
  const [watchlistBusy, setWatchlistBusy] = useState(false);

  const { scan, pollingError, isTerminal } = useScanPolling(activeScanId);

  const sortedCompanies = useMemo(
    () =>
      [...companies].sort((a, b) => {
        const criticalityRank = { critical: 0, important: 1, normal: 2 };
        return (
          criticalityRank[a.criticality] - criticalityRank[b.criticality] ||
          new Date(a.renewal_date).getTime() -
            new Date(b.renewal_date).getTime()
        );
      }),
    [companies],
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
        const alertFilters = scan?.id
          ? { company_id: company.id, scan_id: scan.id }
          : { company_id: company.id };
        const nextAlerts = await listAlerts(alertFilters);
        const scanId = scan?.id ?? nextAlerts[0]?.scan_id ?? null;
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
      setActiveScanId(null);
    }

    void refreshTerminalState();
  }, [isTerminal]);

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

  async function handleAlertReviewStatus(
    alertId: string,
    status: AlertReviewStatus,
  ) {
    setAlertReviewPendingId(alertId);
    setAlertReviewError(null);

    try {
      const updatedAlert = await updateAlertReviewStatus(alertId, status);
      setAlerts((currentAlerts) =>
        currentAlerts.map((alert) =>
          alert.id === updatedAlert.id ? updatedAlert : alert,
        ),
      );
    } catch (error) {
      setAlertReviewError(toErrorMessage(error));
    } finally {
      setAlertReviewPendingId(null);
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
        criticality: vendorForm.criticality,
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
    <main className="min-h-[100dvh] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
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
                  Selected demo vendor: {selectedCompany.name}
                </p>
                <p className="mt-1 text-sm leading-6 text-zinc-600">
                  Critical {selectedCompany.relationship_type} vendor. Renewal{" "}
                  {formatDate(selectedCompany.renewal_date)}. The frontend never
                  calls Bright Data or exposes keys.
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="mt-5 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)_420px]">
          <aside className="space-y-3">
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
                disabled={watchlistBusy || busy || allVendorsMonitored}
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
                    Exact public domain, owner, criticality, renewal date.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={vendorFormOpen ? "Close add vendor form" : "Open add vendor form"}
                  onClick={() => {
                    setVendorFormOpen((open) => !open);
                    setVendorFormError(null);
                    setVendorFormNotice(null);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition hover:border-zinc-300 active:scale-[0.96]"
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
                    Criticality
                    <select
                      value={vendorForm.criticality}
                      onChange={(event) =>
                        setVendorForm((form) => ({
                          ...form,
                          criticality: event.target.value as Criticality,
                        }))
                      }
                      className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-ink-950 outline-none transition focus:border-ink-900 focus:ring-2 focus:ring-ink-900/10"
                    >
                      <option value="critical">Critical</option>
                      <option value="important">Important</option>
                      <option value="normal">Normal</option>
                    </select>
                  </label>
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
            {sortedCompanies.map((company) => (
              <VendorCard
                key={company.id}
                company={company}
                alerts={alerts}
                selected={company.id === selectedCompany.id}
                onSelect={() => setSelectedCompanyId(company.id)}
              />
            ))}
          </aside>

          <section className="min-w-0 space-y-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <AgentToggle
                company={selectedCompany}
                busy={busy || watchlistBusy}
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
              onSave={handleSaveSourceRules}
            />
            {actionError ? (
              <StatePanel
                tone="danger"
                title="Agent action failed"
                body={actionError}
              />
            ) : null}
            {alertReviewError ? (
              <StatePanel
                tone="danger"
                title="Alert review action failed"
                body={alertReviewError}
              />
            ) : null}

            <ReviewStatusStrip
              scan={scan}
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

              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
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
                    title="No verified alerts yet"
                    body="Verified alert cards appear here after a scan scores source-backed evidence."
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
                        Owner: {alert.owner}. Status: {labelize(alert.status)}.
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
                        {(["approved", "dismissed", "needs_review"] as const).map(
                          (status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() =>
                                handleAlertReviewStatus(alert.id, status)
                              }
                              disabled={alertReviewPendingId === alert.id}
                              className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]"
                            >
                              {alertReviewIcon(status)}
                              {alertReviewPendingId === alert.id &&
                              alert.status !== status
                                ? "Updating"
                                : labelize(status)}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                  ))
                )}
              </div>
            </section>
          </section>

          <RiskAssessmentBrief
            brief={brief}
            scan={scan}
            traces={traces}
            loading={briefLoading}
            error={briefError}
            companyName={selectedCompany.name}
            onRequestHtml={() =>
              brief
                ? getVendorReviewBrief(brief.company_id, brief.scan_id, "html")
                : Promise.reject(new Error("A completed brief is required for HTML export."))
            }
          />
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
        reviewError={alertReviewError}
        pendingAlertId={alertReviewPendingId}
        onSelectEvidence={setSelectedEvidenceId}
        onUpdateAlertStatus={handleAlertReviewStatus}
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

  return null;
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
    [...companies].sort((a, b) => {
      const criticalityRank = { critical: 0, important: 1, normal: 2 };
      return (
        criticalityRank[a.criticality] - criticalityRank[b.criticality] ||
        new Date(a.renewal_date).getTime() - new Date(b.renewal_date).getTime()
      );
    })[0] ??
    null
  );
}

function alertReviewIcon(status: AlertReviewStatus) {
  if (status === "approved") {
    return <CheckCircle size={14} weight="bold" />;
  }
  if (status === "dismissed") {
    return <Prohibit size={14} weight="bold" />;
  }
  return <WarningCircle size={14} weight="bold" />;
}
