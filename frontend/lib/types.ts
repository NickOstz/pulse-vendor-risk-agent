export type AgentStatus =
  | "inactive"
  | "active"
  | "running"
  | "completed"
  | "needs_review";

export type ScanStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "completed_with_fallback";

export type ScanMode = "live" | "replay" | "live_with_fallback";
export type ReviewStage = "collect" | "extract" | "verify" | "score" | "brief";
export type StageStatus = "pending" | "running" | "completed" | "failed";
export type SupportStatus =
  | "verified"
  | "needs_review"
  | "no_evidence"
  | "failed_source";
export type SourceMode = "live" | "cached" | "fallback";
export type Criticality = "critical" | "important" | "normal";
export type SignalType = "trust_security" | "adverse_media" | "pricing_terms";
export type AlertReviewStatus = "approved" | "dismissed" | "needs_review";

export interface Company {
  id: string;
  name: string;
  domain: string;
  relationship_type: string;
  owner: string;
  criticality: Criticality;
  renewal_date: string;
  allow_list: string[];
  block_list: string[];
  agent_enabled: boolean;
  agent_status: AgentStatus;
  review_policy: string | null;
  last_agent_run_at: string | null;
  next_agent_run_at: string | null;
}

export interface CompanyCreateInput {
  name: string;
  domain: string;
  relationship_type: string;
  owner: string;
  criticality: Criticality;
  renewal_date: string;
  allow_list?: string[];
  block_list?: string[];
}

export interface SourceRulesUpdateInput {
  allow_list: string[];
  block_list: string[];
}

export interface ScanStage {
  name: ReviewStage;
  status: StageStatus;
}

export interface ScanMetrics {
  serp_queries_used: number;
  urls_scraped: number;
  llm_calls_used: number;
  evidence_count: number;
  verified_count: number;
}

export interface ScanStatusResponse {
  id: string;
  company_id: string;
  status: ScanStatus;
  mode: ScanMode;
  current_stage: ReviewStage;
  stages: ScanStage[];
  metrics: ScanMetrics;
}

export interface EvidenceItem {
  id: string;
  scan_id: string;
  company_id: string;
  signal_type: SignalType;
  claim: string;
  supporting_quote: string;
  source_url: string;
  source_type: string;
  published_or_captured_at: string;
  severity_hint: "low" | "medium" | "high";
  confidence: number;
  recommended_action: string;
  support_status: SupportStatus;
  quote_match_score: number | null;
  source_excerpt: string;
}

export interface BrightDataTrace {
  id: string;
  scan_id: string;
  product: string;
  operation: string;
  source_url: string | null;
  status: string;
  latency_ms: number | null;
  retry_count: number;
  error: string | null;
  source_mode: SourceMode;
  created_at: string;
}

export interface Alert {
  id: string;
  company_id: string;
  scan_id: string;
  evidence_item_id: string | null;
  alert_type: "signal" | "related_change";
  title: string;
  summary: string;
  score: number;
  severity: "low" | "medium" | "high";
  status: "new" | AlertReviewStatus;
  owner: string;
  recommended_action: string;
  related_evidence_ids: string[];
  score_factors: Record<string, unknown>;
  created_at: string;
}

export interface AgentRun {
  company_id: string;
  scan_id: string;
  current_stage: ReviewStage;
}

export interface AgentStatusResponse {
  active_runs: AgentRun[];
  due_vendors: Company[];
}

export interface VendorReviewBrief {
  company_id: string;
  scan_id: string;
  format: "markdown" | "html";
  content: string;
}

export interface HealthResponse {
  status: string;
  database: boolean;
  scheduler: boolean;
  replay_data: boolean;
  brightdata_key_present: boolean;
  llm_key_present: boolean;
}
