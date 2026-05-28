import type { EvidenceItem } from "@/lib/types";

export type AutonomousMcpWork = {
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
      vendor: "AWS",
      targetVendor: "Cloudflare",
      sourceMcp: "https://aws-mcp.us-east-1.api.aws/mcp",
      targetMcp: "https://mcp.cloudflare.com/mcp",
      summary:
        "Pulse action: migrated affected edge traffic from AWS to Cloudflare. Issue resolved.",
      result:
        "Cloudflare route is serving the protected workload; AWS dependency remains monitored until recovery stabilizes.",
      steps: [
        "Alerted IT owner that verified AWS outage evidence crossed the high-severity threshold.",
        "Connected to AWS MCP to freeze the affected dependency and capture current routing state.",
        "Connected to Cloudflare MCP and promoted the standby edge route for the impacted service.",
        "Verified the Cloudflare route returned healthy checks and closed the incident as resolved.",
      ],
    };
  }

  if (text.includes("cloudflare")) {
    return {
      vendor: "Cloudflare",
      targetVendor: "AWS",
      sourceMcp: "https://mcp.cloudflare.com/mcp",
      targetMcp: "https://aws-mcp.us-east-1.api.aws/mcp",
      summary:
        "Pulse action: migrated affected edge traffic from Cloudflare to AWS. Issue resolved.",
      result:
        "AWS fallback route is active; Cloudflare dependency remains monitored until the outage clears.",
      steps: [
        "Alerted Security owner that verified Cloudflare outage evidence crossed the high-severity threshold.",
        "Connected to Cloudflare MCP to pause the impacted edge route and capture failover context.",
        "Connected to AWS MCP and promoted the standby application route for the affected traffic.",
        "Verified the AWS route returned healthy checks and closed the incident as resolved.",
      ],
    };
  }

  return null;
}
