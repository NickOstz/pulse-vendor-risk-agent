import type {
  Alert,
  BrightDataTrace,
  Company,
  EvidenceItem,
  ScanStatusResponse,
  VendorReviewBrief,
} from "@/lib/types";

export const demoScanId = "scan_dataforge_20260526";
export const demoCompanyId = "vendor_dataforge";

export const companiesFixture: Company[] = [
  {
    id: demoCompanyId,
    name: "DataForge",
    domain: "dataforge.example",
    relationship_type: "database",
    owner: "Security",
    criticality: "critical",
    renewal_date: "2026-07-10",
    agent_enabled: false,
    agent_status: "inactive",
    review_policy: null,
    last_agent_run_at: null,
    next_agent_run_at: null,
  },
  {
    id: "vendor_clearpath",
    name: "Clearpath Payroll",
    domain: "clearpath-payroll.example",
    relationship_type: "payroll",
    owner: "People Ops",
    criticality: "critical",
    renewal_date: "2026-08-18",
    agent_enabled: true,
    agent_status: "completed",
    review_policy: "weekly",
    last_agent_run_at: "2026-05-25T08:15:00Z",
    next_agent_run_at: "2026-06-01T08:15:00Z",
  },
  {
    id: "vendor_northstar",
    name: "Northstar Analytics",
    domain: "northstar-analytics.example",
    relationship_type: "analytics",
    owner: "Data",
    criticality: "important",
    renewal_date: "2026-09-04",
    agent_enabled: true,
    agent_status: "active",
    review_policy: "weekly",
    last_agent_run_at: "2026-05-22T17:40:00Z",
    next_agent_run_at: "2026-05-29T17:40:00Z",
  },
  {
    id: "vendor_slateid",
    name: "SlateID",
    domain: "slateid.example",
    relationship_type: "identity",
    owner: "Engineering",
    criticality: "normal",
    renewal_date: "2026-11-22",
    agent_enabled: false,
    agent_status: "inactive",
    review_policy: null,
    last_agent_run_at: null,
    next_agent_run_at: null,
  },
];

export const scanProgression: ScanStatusResponse[] = [
  {
    id: demoScanId,
    company_id: demoCompanyId,
    status: "running",
    mode: "live_with_fallback",
    current_stage: "collect",
    stages: [
      { name: "collect", status: "running" },
      { name: "extract", status: "pending" },
      { name: "verify", status: "pending" },
      { name: "score", status: "pending" },
      { name: "brief", status: "pending" },
    ],
    metrics: {
      serp_queries_used: 2,
      urls_scraped: 1,
      llm_calls_used: 0,
      evidence_count: 0,
      verified_count: 0,
    },
  },
  {
    id: demoScanId,
    company_id: demoCompanyId,
    status: "running",
    mode: "live_with_fallback",
    current_stage: "extract",
    stages: [
      { name: "collect", status: "completed" },
      { name: "extract", status: "running" },
      { name: "verify", status: "pending" },
      { name: "score", status: "pending" },
      { name: "brief", status: "pending" },
    ],
    metrics: {
      serp_queries_used: 2,
      urls_scraped: 4,
      llm_calls_used: 2,
      evidence_count: 1,
      verified_count: 0,
    },
  },
  {
    id: demoScanId,
    company_id: demoCompanyId,
    status: "running",
    mode: "live_with_fallback",
    current_stage: "verify",
    stages: [
      { name: "collect", status: "completed" },
      { name: "extract", status: "completed" },
      { name: "verify", status: "running" },
      { name: "score", status: "pending" },
      { name: "brief", status: "pending" },
    ],
    metrics: {
      serp_queries_used: 2,
      urls_scraped: 4,
      llm_calls_used: 4,
      evidence_count: 3,
      verified_count: 1,
    },
  },
  {
    id: demoScanId,
    company_id: demoCompanyId,
    status: "running",
    mode: "live_with_fallback",
    current_stage: "score",
    stages: [
      { name: "collect", status: "completed" },
      { name: "extract", status: "completed" },
      { name: "verify", status: "completed" },
      { name: "score", status: "running" },
      { name: "brief", status: "pending" },
    ],
    metrics: {
      serp_queries_used: 2,
      urls_scraped: 4,
      llm_calls_used: 4,
      evidence_count: 3,
      verified_count: 2,
    },
  },
  {
    id: demoScanId,
    company_id: demoCompanyId,
    status: "completed_with_fallback",
    mode: "live_with_fallback",
    current_stage: "brief",
    stages: [
      { name: "collect", status: "completed" },
      { name: "extract", status: "completed" },
      { name: "verify", status: "completed" },
      { name: "score", status: "completed" },
      { name: "brief", status: "completed" },
    ],
    metrics: {
      serp_queries_used: 2,
      urls_scraped: 4,
      llm_calls_used: 4,
      evidence_count: 3,
      verified_count: 2,
    },
  },
];

export const evidenceFixture: EvidenceItem[] = [
  {
    id: "evidence_trust_001",
    scan_id: demoScanId,
    company_id: demoCompanyId,
    signal_type: "trust_security",
    claim:
      "DataForge moved its SOC 2 Type II report access behind customer approval and added a 48-hour review note.",
    supporting_quote:
      "SOC 2 Type II reports are available to customers after account team approval, with review typically completed within 48 hours.",
    source_url: "https://dataforge.example/trust",
    source_type: "vendor_owned",
    published_or_captured_at: "2026-05-26T03:45:00Z",
    severity_hint: "medium",
    confidence: 0.91,
    recommended_action:
      "Ask DataForge for renewal-period report access and confirm whether approval delays affect audit evidence collection.",
    support_status: "verified",
    quote_match_score: 0.94,
    source_excerpt:
      "Security and compliance resources: SOC 2 Type II reports are available to customers after account team approval, with review typically completed within 48 hours. DataForge also provides ISO 27001 and penetration test summaries through the trust portal.",
  },
  {
    id: "evidence_terms_001",
    scan_id: demoScanId,
    company_id: demoCompanyId,
    signal_type: "pricing_terms",
    claim:
      "DataForge updated renewal terms to require enterprise plans for advanced audit logs.",
    supporting_quote:
      "Advanced audit log retention is available on Enterprise plans for customers renewing after June 30, 2026.",
    source_url: "https://dataforge.example/pricing",
    source_type: "vendor_owned",
    published_or_captured_at: "2026-05-26T03:47:00Z",
    severity_hint: "high",
    confidence: 0.88,
    recommended_action:
      "Bring procurement and the database owner into renewal review before the June 30 packaging cutoff.",
    support_status: "verified",
    quote_match_score: 0.91,
    source_excerpt:
      "Plan notes for current customers: Advanced audit log retention is available on Enterprise plans for customers renewing after June 30, 2026. Standard plans continue to include 30 days of admin activity logs.",
  },
  {
    id: "evidence_media_001",
    scan_id: demoScanId,
    company_id: demoCompanyId,
    signal_type: "adverse_media",
    claim:
      "A public search result mentioned an outage summary, but the captured page did not contain enough matching source text.",
    supporting_quote:
      "Customers experienced elevated query latency in two regions.",
    source_url: "https://status.dataforge.example/history",
    source_type: "vendor_owned",
    published_or_captured_at: "2026-05-24T11:20:00Z",
    severity_hint: "medium",
    confidence: 0.67,
    recommended_action:
      "Leave this item out of high-priority scoring until the status history can be rechecked.",
    support_status: "needs_review",
    quote_match_score: 0.42,
    source_excerpt:
      "Historical incidents are listed by date and region. The latest entry describes maintenance on analytics replicas, but the source snapshot did not include the extracted outage wording.",
  },
];

export const tracesFixture: BrightDataTrace[] = [
  {
    id: "trace_serp_001",
    scan_id: demoScanId,
    product: "serp",
    operation: "query: dataforge trust security soc 2",
    source_url: null,
    status: "success",
    latency_ms: 816,
    retry_count: 0,
    error: null,
    source_mode: "live",
    created_at: "2026-05-26T03:44:12Z",
  },
  {
    id: "trace_scrape_001",
    scan_id: demoScanId,
    product: "markdown_scrape",
    operation: "scrape_markdown",
    source_url: "https://dataforge.example/trust",
    status: "success",
    latency_ms: 1088,
    retry_count: 0,
    error: null,
    source_mode: "live",
    created_at: "2026-05-26T03:45:01Z",
  },
  {
    id: "trace_unlocker_001",
    scan_id: demoScanId,
    product: "web_unlocker",
    operation: "scrape_markdown",
    source_url: "https://dataforge.example/pricing",
    status: "timeout",
    latency_ms: 8124,
    retry_count: 1,
    error: "Live fetch exceeded the 8 second demo timeout.",
    source_mode: "live",
    created_at: "2026-05-26T03:46:38Z",
  },
  {
    id: "trace_cache_001",
    scan_id: demoScanId,
    product: "replay_loader",
    operation: "load_cached_source",
    source_url: "https://dataforge.example/pricing",
    status: "fallback_used",
    latency_ms: 22,
    retry_count: 0,
    error: null,
    source_mode: "fallback",
    created_at: "2026-05-26T03:46:39Z",
  },
  {
    id: "trace_status_001",
    scan_id: demoScanId,
    product: "markdown_scrape",
    operation: "scrape_markdown",
    source_url: "https://status.dataforge.example/history",
    status: "cached",
    latency_ms: 18,
    retry_count: 0,
    error: null,
    source_mode: "cached",
    created_at: "2026-05-26T03:47:10Z",
  },
];

export const alertsFixture: Alert[] = [
  {
    id: "alert_terms_001",
    company_id: demoCompanyId,
    scan_id: demoScanId,
    evidence_item_id: "evidence_terms_001",
    alert_type: "signal",
    title: "Audit log packaging changed before renewal",
    summary:
      "Verified pricing-page evidence says advanced audit log retention moves to Enterprise for renewals after June 30.",
    score: 68,
    severity: "high",
    status: "new",
    owner: "Procurement",
    recommended_action:
      "Confirm Enterprise packaging impact before the DataForge renewal is signed.",
    related_evidence_ids_json: "[\"evidence_terms_001\"]",
    score_factors_json:
      "{\"base_severity\":0.9,\"source_reliability\":0.9,\"confidence\":0.88,\"freshness\":0.99,\"vendor_criticality\":1.2}",
    created_at: "2026-05-26T03:48:00Z",
  },
  {
    id: "alert_related_001",
    company_id: demoCompanyId,
    scan_id: demoScanId,
    evidence_item_id: null,
    alert_type: "related_change",
    title: "Related renewal evidence requires owner review",
    summary:
      "Trust access and audit-log packaging both changed inside the same review window for a critical database vendor.",
    score: 61,
    severity: "medium",
    status: "new",
    owner: "Security",
    recommended_action:
      "Review DataForge trust access and renewal packaging together before procurement approval.",
    related_evidence_ids_json:
      "[\"evidence_trust_001\",\"evidence_terms_001\"]",
    score_factors_json:
      "{\"rule\":\"two_verified_compatible_signals\",\"verified_evidence_count\":2,\"unsupported_evidence_excluded\":1}",
    created_at: "2026-05-26T03:49:00Z",
  },
];

export const briefFixture: VendorReviewBrief = {
  company_id: demoCompanyId,
  scan_id: demoScanId,
  format: "markdown",
  content:
    "# Vendor Risk Assessment Brief\n\n## Summary\nDataForge remains usable for the renewal path, but Pulse found two verified public changes that should be reviewed before signature: trust-report access timing and audit-log packaging.\n\n## Key verified changes\n- SOC 2 Type II reports now require account team approval with a typical 48-hour review.\n- Advanced audit log retention is listed as Enterprise-only for renewals after June 30, 2026.\n\n## Risk interpretation\nThe evidence does not show a confirmed security incident. The renewal risk is operational and procurement-oriented: audit evidence may take longer to retrieve, and the requested logging control may require a different plan.\n\n## Recommended action\nSecurity and Procurement should ask DataForge for report access confirmation and audit-log retention terms before renewal approval.\n\n## Suggested owner\nProcurement with Security review.\n\n## Review status\nCompleted with fallback. One live pricing fetch timed out and a cached source was used with an explicit fallback trace.",
};
