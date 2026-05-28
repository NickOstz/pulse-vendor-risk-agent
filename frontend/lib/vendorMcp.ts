import type { Company } from "@/lib/types";

const vendorMcpStorageKey = "pulse.vendorMcpServers";

const defaultVendorMcpServers: Record<string, string> = {
  "cloudflare.com": "https://mcp.cloudflare.com/mcp",
  "aws.amazon.com": "https://aws-mcp.us-east-1.api.aws/mcp",
  "paddle.com": "https://mcp.paddle.com/mcp",
  "snowflake.com":
    "https://<account_url>/api/v2/databases/{database}/schemas/{schema}/mcp-servers/{name}",
  "vercel.com": "https://mcp.vercel.com",
};

type StoredVendorMcpServers = Record<string, string>;

export function getVendorMcpServerUrl(company: Company) {
  const storedServers = readStoredVendorMcpServers();
  return (
    storedServers[company.id] ??
    storedServers[company.domain] ??
    defaultVendorMcpServers[company.domain] ??
    null
  );
}

export function saveVendorMcpServerUrl(company: Company, url: string) {
  if (typeof window === "undefined") return;

  const normalizedUrl = url.trim();
  if (!normalizedUrl) return;

  const storedServers = readStoredVendorMcpServers();
  writeStoredVendorMcpServers({
    ...storedServers,
    [company.id]: normalizedUrl,
    [company.domain]: normalizedUrl,
  });
}

function readStoredVendorMcpServers(): StoredVendorMcpServers {
  if (typeof window === "undefined") return {};

  try {
    const storedValue = window.localStorage.getItem(vendorMcpStorageKey);
    if (!storedValue) return {};

    const parsedValue: unknown = JSON.parse(storedValue);
    if (!parsedValue || typeof parsedValue !== "object") return {};

    return Object.fromEntries(
      Object.entries(parsedValue).filter(
        (entry): entry is [string, string] =>
          typeof entry[0] === "string" && typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}

function writeStoredVendorMcpServers(servers: StoredVendorMcpServers) {
  try {
    window.localStorage.setItem(vendorMcpStorageKey, JSON.stringify(servers));
  } catch {
    // This is a demo-only UI hint; failing to persist should not break vendor creation.
  }
}
