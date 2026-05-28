import type { EvidenceItem } from "@/lib/types";

export type AutonomousMcpWork = {
  evidenceId: string;
  sourceUrl: string;
  workKey: string;
  vendor: string;
  title: string;
  statusLabel: string;
  description: string;
  pathLabel: string;
  pathNodes: string[];
  mcpEndpoints: Array<{ label: string; value: string }>;
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
  const breachSignal =
    text.includes("breach") ||
    text.includes("data theft") ||
    text.includes("unauthorized access") ||
    text.includes("compromised") ||
    text.includes("credential") ||
    text.includes("oauth") ||
    text.includes("environment variable");

  if (outageSignal && (text.includes("aws") || text.includes("amazon"))) {
    return {
      evidenceId: evidence.id,
      sourceUrl: evidence.source_url,
      workKey: "outage:aws-to-cloudflare",
      vendor: "AWS",
      title: "Autonomous outage migration completed",
      statusLabel: "Issue resolved",
      description:
        "High-severity outage evidence triggered autonomous work. Pulse alerted the owner, used the vendor MCP servers, moved the affected service to a healthy provider, and confirmed the issue is resolved.",
      pathLabel: "Service migration path",
      pathNodes: ["AWS", "Cloudflare"],
      mcpEndpoints: [
        { label: "AWS MCP", value: "https://aws-mcp.us-east-1.api.aws/mcp" },
        { label: "Cloudflare MCP", value: "https://mcp.cloudflare.com/mcp" },
      ],
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

  if (outageSignal && text.includes("cloudflare")) {
    return {
      evidenceId: evidence.id,
      sourceUrl: evidence.source_url,
      workKey: "outage:cloudflare-to-aws",
      vendor: "Cloudflare",
      title: "Autonomous outage migration completed",
      statusLabel: "Issue resolved",
      description:
        "High-severity outage evidence triggered autonomous work. Pulse alerted the owner, used the vendor MCP servers, moved the affected service to a healthy provider, and confirmed the issue is resolved.",
      pathLabel: "Service migration path",
      pathNodes: ["Cloudflare", "AWS"],
      mcpEndpoints: [
        { label: "Cloudflare MCP", value: "https://mcp.cloudflare.com/mcp" },
        { label: "AWS MCP", value: "https://aws-mcp.us-east-1.api.aws/mcp" },
      ],
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

  if (breachSignal && text.includes("snowflake")) {
    return {
      evidenceId: evidence.id,
      sourceUrl: evidence.source_url,
      workKey: "breach:snowflake-credential-hardening",
      vendor: "Snowflake",
      title: "Autonomous data-breach containment completed",
      statusLabel: "Risk contained",
      description:
        "High-severity breach evidence triggered autonomous containment. Pulse alerted the Data owner, used the Snowflake MCP server, tightened account access, and confirmed the tenant is in a safer review state.",
      pathLabel: "Containment path",
      pathNodes: ["Snowflake", "MFA enforced", "Access narrowed"],
      mcpEndpoints: [
        {
          label: "Snowflake MCP",
          value:
            "https://<account_url>/api/v2/databases/{database}/schemas/{schema}/mcp-servers/{name}",
        },
      ],
      summary:
        "Pulse enforced Snowflake MFA, rotated exposed credentials, narrowed network access, and opened an exfiltration review.",
      result:
        "Snowflake access is locked behind MFA and trusted network rules; exposed credentials were rotated and query history remains under review.",
      steps: [
        "Alerted Data owner that verified Snowflake breach evidence was high severity.",
        "Connected to Snowflake MCP to list users, service accounts, sessions, and recent query activity.",
        "Rotated exposed passwords and API secrets, revoked active sessions, and enforced MFA on every interactive account.",
        "Applied trusted network rules and flagged unusual data-export queries for follow-up review.",
      ],
    };
  }

  if (breachSignal && text.includes("vercel")) {
    return {
      evidenceId: evidence.id,
      sourceUrl: evidence.source_url,
      workKey: "breach:vercel-oauth-env-secrets",
      vendor: "Vercel",
      title: "Autonomous secret-containment completed",
      statusLabel: "Risk contained",
      description:
        "High-severity breach evidence triggered autonomous containment. Pulse alerted Engineering, used the Vercel MCP server, protected exposed deployment secrets, and confirmed the project is in a safer review state.",
      pathLabel: "Secret containment path",
      pathNodes: ["Vercel", "Secrets rotated", "Deployments verified"],
      mcpEndpoints: [
        { label: "Vercel MCP", value: "https://mcp.vercel.com" },
      ],
      summary:
        "Pulse rotated exposed Vercel environment secrets, marked sensitive variables, revoked risky OAuth grants, and verified clean redeployments.",
      result:
        "Vercel projects are using rotated sensitive variables; risky OAuth access was revoked and recent deployments were checked for unexpected changes.",
      steps: [
        "Alerted Engineering that verified Vercel breach evidence was high severity.",
        "Connected to Vercel MCP to inventory projects, environment variables, OAuth integrations, and recent deployments.",
        "Rotated API keys, database URLs, webhook secrets, and tokens stored in exposed environment variables.",
        "Marked secrets as sensitive, revoked risky OAuth grants, redeployed affected projects, and checked activity logs for unexpected changes.",
      ],
    };
  }

  return null;
}
