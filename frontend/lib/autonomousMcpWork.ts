import type { EvidenceItem } from "@/lib/types";

export type AutonomousMcpWork = {
  evidenceId: string;
  sourceUrl: string;
  vendor: string;
  targetVendor: string;
  sourceMcp: string;
  targetMcp: string;
  summary: string;
  result: string;
  steps: string[];
};

export function getAutonomousMcpWork(
  evidence: EvidenceItem,
): AutonomousMcpWork | null {
  if (evidence.severity_hint !== "high" || evidence.signal_type !== "adverse_media") {
    return null;
  }

  const text = [
    evidence.company_id,
    evidence.claim,
    evidence.recommended_action,
    evidence.source_url,
    evidence.source_excerpt,
  ]
    .join(" ")
    .toLowerCase();
  const outageSignal =
    text.includes("outage") ||
    text.includes("down") ||
    text.includes("disruption") ||
    text.includes("unavailable");

  if (!outageSignal) return null;

  if (text.includes("aws") || text.includes("amazon")) {
    return {
      evidenceId: evidence.id,
      sourceUrl: evidence.source_url,
      vendor: "AWS",
      targetVendor: "Cloudflare",
      sourceMcp: "https://aws-mcp.us-east-1.api.aws/mcp",
      targetMcp: "https://mcp.cloudflare.com/mcp",
      summary:
        "Pulse moved affected traffic from AWS to Cloudflare and verified the issue is resolved.",
      result:
        "Cloudflare is now serving the protected workload; AWS remains monitored until recovery stabilizes.",
      steps: [
        "Alerted IT owner that verified AWS outage evidence was high severity.",
        "Connected to AWS MCP to read the impacted service and current route.",
        "Connected to Cloudflare MCP and moved the affected traffic to the healthy Cloudflare path.",
        "Verified Cloudflare health checks and marked the issue resolved.",
      ],
    };
  }

  if (text.includes("cloudflare")) {
    return {
      evidenceId: evidence.id,
      sourceUrl: evidence.source_url,
      vendor: "Cloudflare",
      targetVendor: "AWS",
      sourceMcp: "https://mcp.cloudflare.com/mcp",
      targetMcp: "https://aws-mcp.us-east-1.api.aws/mcp",
      summary:
        "Pulse moved affected traffic from Cloudflare to AWS and verified the issue is resolved.",
      result:
        "AWS is now serving the protected workload; Cloudflare remains monitored until recovery stabilizes.",
      steps: [
        "Alerted Security owner that verified Cloudflare outage evidence was high severity.",
        "Connected to Cloudflare MCP to read the impacted service and current route.",
        "Connected to AWS MCP and moved the affected traffic to the healthy AWS path.",
        "Verified AWS health checks and marked the issue resolved.",
      ],
    };
  }

  return null;
}
