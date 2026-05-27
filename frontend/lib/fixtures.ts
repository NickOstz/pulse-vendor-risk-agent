import type {
  Alert,
  BrightDataTrace,
  Company,
  EvidenceItem,
  ScanStatusResponse,
  VendorReviewBrief,
} from "@/lib/types";

export const demoScanId = "scan_cloudflare_20260526";
export const demoCompanyId = "vendor_cloudflare";

export const companiesFixture: Company[] = [
  {
    id: demoCompanyId,
    name: "Cloudflare",
    domain: "cloudflare.com",
    relationship_type: "edge security",
    owner: "Security",
    criticality: "critical",
    renewal_date: "2026-07-10",
    allow_list: [
      "https://www.cloudflare.com/trust-hub/",
      "https://developers.cloudflare.com/data-localization/",
      "https://www.cloudflarestatus.com/",
    ],
    block_list: [],
    agent_enabled: false,
    agent_status: "inactive",
    review_policy: null,
    last_agent_run_at: null,
    next_agent_run_at: null,
  },
  {
    id: "vendor_snowflake",
    name: "Snowflake",
    domain: "snowflake.com",
    relationship_type: "data warehouse",
    owner: "Data",
    criticality: "normal",
    renewal_date: "2027-01-20",
    allow_list: ["https://www.snowflake.com/en/why-snowflake/snowflake-security-hub/"],
    block_list: [],
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
    mode: "live",
    current_stage: "collect",
    stages: [
      { name: "collect", status: "running" },
      { name: "extract", status: "pending" },
      { name: "verify", status: "pending" },
      { name: "score", status: "pending" },
      { name: "brief", status: "pending" },
    ],
    metrics: {
      serp_queries_used: 1,
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
    mode: "live",
    current_stage: "extract",
    stages: [
      { name: "collect", status: "completed" },
      { name: "extract", status: "running" },
      { name: "verify", status: "pending" },
      { name: "score", status: "pending" },
      { name: "brief", status: "pending" },
    ],
    metrics: {
      serp_queries_used: 1,
      urls_scraped: 1,
      llm_calls_used: 0,
      evidence_count: 1,
      verified_count: 0,
    },
  },
  {
    id: demoScanId,
    company_id: demoCompanyId,
    status: "running",
    mode: "live",
    current_stage: "verify",
    stages: [
      { name: "collect", status: "completed" },
      { name: "extract", status: "completed" },
      { name: "verify", status: "running" },
      { name: "score", status: "pending" },
      { name: "brief", status: "pending" },
    ],
    metrics: {
      serp_queries_used: 1,
      urls_scraped: 1,
      llm_calls_used: 0,
      evidence_count: 3,
      verified_count: 1,
    },
  },
  {
    id: demoScanId,
    company_id: demoCompanyId,
    status: "running",
    mode: "live",
    current_stage: "score",
    stages: [
      { name: "collect", status: "completed" },
      { name: "extract", status: "completed" },
      { name: "verify", status: "completed" },
      { name: "score", status: "running" },
      { name: "brief", status: "pending" },
    ],
    metrics: {
      serp_queries_used: 1,
      urls_scraped: 1,
      llm_calls_used: 0,
      evidence_count: 3,
      verified_count: 3,
    },
  },
  {
    id: demoScanId,
    company_id: demoCompanyId,
    status: "completed",
    mode: "live",
    current_stage: "brief",
    stages: [
      { name: "collect", status: "completed" },
      { name: "extract", status: "completed" },
      { name: "verify", status: "completed" },
      { name: "score", status: "completed" },
      { name: "brief", status: "completed" },
    ],
    metrics: {
      serp_queries_used: 1,
      urls_scraped: 1,
      llm_calls_used: 0,
      evidence_count: 3,
      verified_count: 3,
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
      "Cloudflare publicly identifies SOC 2 Type II and ISO 27001 among its compliance resources.",
    supporting_quote:
      "Explore our posture around ISO 27001, ISO 27701, PCI DSS, SOC 2 Type II, and others",
    source_url: "https://www.cloudflare.com/trust-hub/",
    source_type: "vendor_owned",
    published_or_captured_at: "2026-05-26T03:45:00Z",
    severity_hint: "medium",
    confidence: 0.95,
    recommended_action:
      "Request the current in-scope compliance package for the renewal record.",
    support_status: "verified",
    quote_match_score: 1,
    source_excerpt:
      "Compliance resources: Explore our posture around ISO 27001, ISO 27701, PCI DSS, SOC 2 Type II, and others.",
  },
];

export const tracesFixture: BrightDataTrace[] = [
  {
    id: "trace_serp_001",
    scan_id: demoScanId,
    product: "serp_api",
    operation: "query: cloudflare trust security soc 2 incident terms",
    source_url: "https://www.google.com/search?q=cloudflare+trust+security+soc+2+incident+terms",
    status: "success",
    latency_ms: 816,
    retry_count: 0,
    error: null,
    source_mode: "live",
    created_at: "2026-05-26T03:44:12Z",
  },
  {
    id: "trace_unlocker_001",
    scan_id: demoScanId,
    product: "web_unlocker",
    operation: "scrape_markdown:configured_demo_source",
    source_url: "https://www.cloudflare.com/trust-hub/",
    status: "success",
    latency_ms: 1088,
    retry_count: 0,
    error: null,
    source_mode: "live",
    created_at: "2026-05-26T03:45:01Z",
  },
];

export const alertsFixture: Alert[] = [
  {
    id: "alert_trust_001",
    company_id: demoCompanyId,
    scan_id: demoScanId,
    evidence_item_id: "evidence_trust_001",
    alert_type: "signal",
    title: "Live compliance posture captured for renewal review",
    summary:
      "Live Cloudflare Trust Hub evidence lists SOC 2 Type II and ISO 27001 among its compliance resources.",
    score: 62,
    severity: "medium",
    status: "new",
    owner: "Security",
    recommended_action:
      "Request the current in-scope compliance package for the renewal record.",
    related_evidence_ids: ["evidence_trust_001"],
    score_factors: {
      base_severity: 0.6,
      source_reliability: 0.9,
      confidence: 0.95,
      freshness: 1,
      vendor_criticality: 1.2,
    },
    created_at: "2026-05-26T03:48:00Z",
  },
];

export const briefFixture: VendorReviewBrief = {
  company_id: demoCompanyId,
  scan_id: demoScanId,
  format: "markdown",
  content:
    "# Vendor Risk Assessment Brief: Cloudflare\n\n## Summary\nCloudflare is a critical edge security vendor with renewal on 2026-07-10. Pulse assembled 1 live verified public-source signal for renewal review.\n\n## Key Verified Changes\n- Trust / security: Cloudflare publicly identifies SOC 2 Type II and ISO 27001 among its compliance resources.\n\n## Evidence Table\n| Signal | Severity | Mode | Support | Source | Recommended action |\n| --- | --- | --- | --- | --- | --- |\n| Trust / security | medium | live | verified | https://www.cloudflare.com/trust-hub/ | Request the current in-scope compliance package for the renewal record. |\n\n## Risk Interpretation\nThis verified public statement is a review trigger, not proof of a control failure or unresolved incident. Security should confirm assurance documentation before renewal.\n\n## Recommended Action\n- Request the current in-scope compliance package for the renewal record.\n\n## Suggested Owner\nSecurity, with Procurement support.\n\n## Review Status\nNeeds review before renewal. This brief includes only verified evidence: 1 live verified public-source signal.",
};
