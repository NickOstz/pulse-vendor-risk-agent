"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ShieldWarning } from "@phosphor-icons/react";
import { AgentStatusPanel } from "@/components/AgentStatusPanel";
import { AgentToggle } from "@/components/AgentToggle";
import { Badge } from "@/components/Badge";
import { EvidenceDrawer } from "@/components/EvidenceDrawer";
import { ReviewStatusStrip } from "@/components/ReviewStatusStrip";
import { RiskAssessmentBrief } from "@/components/RiskAssessmentBrief";
import { VendorCard } from "@/components/VendorCard";
import { useScanPolling } from "@/hooks/useScanPolling";
import {
  getAgentStatus,
  getVendorReviewBrief,
  listAlerts,
  listBrightDataTraces,
  listCompanies,
  listEvidence,
  setVendorRiskAgent,
} from "@/lib/api";
import { demoCompanyId, demoScanId } from "@/lib/fixtures";
import { formatDate, labelize } from "@/lib/formatters";
import type {
  AgentStatusResponse,
  Alert,
  BrightDataTrace,
  Company,
  EvidenceItem,
  VendorReviewBrief,
} from "@/lib/types";

export function CommandCenter() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(demoCompanyId);
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
    companies.find((company) => company.id === demoCompanyId) ??
    null;

  const selectedAlerts = alerts.filter(
    (alert) => alert.company_id === selectedCompany?.id,
  );

  useEffect(() => {
    async function loadInitialData() {
      const nextCompanies = await listCompanies();
      const nextAlerts = await listAlerts({ company_id: demoCompanyId });
      const nextEvidence = await listEvidence(demoCompanyId, demoScanId);
      const nextTraces = await listBrightDataTraces(demoScanId);
      const nextBrief = await getVendorReviewBrief(demoCompanyId, demoScanId);
      const nextAgentStatus = await getAgentStatus();

      setCompanies(nextCompanies);
      setAlerts(nextAlerts);
      setEvidence(nextEvidence);
      setTraces(nextTraces);
      setBrief(nextBrief);
      setAgentStatus(nextAgentStatus);
      setSelectedEvidenceId(nextEvidence[0]?.id ?? null);
    }

    void loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedCompany) return;
    const company = selectedCompany;

    async function refreshSelectedData() {
      const scanId = scan?.id ?? demoScanId;
      const [nextAlerts, nextEvidence, nextTraces, nextBrief] =
        await Promise.all([
          listAlerts({ company_id: company.id }),
          listEvidence(company.id, scanId),
          listBrightDataTraces(scanId),
          getVendorReviewBrief(company.id, scanId),
        ]);

      setAlerts(nextAlerts);
      setEvidence(nextEvidence);
      setTraces(nextTraces);
      setBrief(nextBrief);
      setSelectedEvidenceId((current) => current ?? nextEvidence[0]?.id ?? null);
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

    try {
      const updatedCompany = await setVendorRiskAgent(selectedCompany.id, enabled);
      const nextCompanies = companies.map((company) =>
        company.id === updatedCompany.id ? updatedCompany : company,
      );
      const nextAgentStatus = await getAgentStatus();
      const activeRun = nextAgentStatus.active_runs.find(
        (run) => run.company_id === updatedCompany.id,
      );

      setCompanies(nextCompanies);
      setAgentStatus(nextAgentStatus);
      setActiveScanId(activeRun?.scan_id ?? null);
    } finally {
      setBusy(false);
    }
  }

  if (!selectedCompany) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center p-6">
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-soft">
          Loading Pulse command center.
        </div>
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
              <Badge tone="warn">Fixture replay until backend lands</Badge>
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
                  {formatDate(selectedCompany.renewal_date)}. The fixture client
                  never calls Bright Data or exposes keys.
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="mt-5 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)_420px]">
          <aside className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-ink-950">
                Vendor watchlist
              </h2>
              <span className="font-mono text-xs text-zinc-500">
                sorted for demo
              </span>
            </div>
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
                busy={busy}
                onToggle={handleToggle}
              />
              <AgentStatusPanel
                company={selectedCompany}
                agentStatus={agentStatus}
                scan={scan}
              />
            </div>

            <ReviewStatusStrip scan={scan} pollingError={pollingError} />

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
                {selectedAlerts.map((alert) => (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => {
                      const relatedIds = JSON.parse(
                        alert.related_evidence_ids_json,
                      ) as string[];
                      setSelectedEvidenceId(
                        alert.evidence_item_id ?? relatedIds[0] ?? null,
                      );
                      setDrawerOpen(true);
                    }}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-left transition hover:border-zinc-300 active:scale-[0.99]"
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
                    <p className="mt-3 border-t border-zinc-200 pt-3 text-xs text-zinc-500">
                      Owner: {alert.owner}. Status: {labelize(alert.status)}.
                    </p>
                  </button>
                ))}
              </div>
            </section>
          </section>

          <RiskAssessmentBrief brief={brief} />
        </div>
      </div>

      <EvidenceDrawer
        open={drawerOpen}
        alerts={selectedAlerts}
        evidence={evidence}
        traces={traces}
        selectedEvidenceId={selectedEvidenceId}
        onSelectEvidence={setSelectedEvidenceId}
        onClose={() => setDrawerOpen(false)}
      />
    </main>
  );
}
