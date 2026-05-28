"use client";

import { useState } from "react";
import { DownloadSimple, FileText } from "@phosphor-icons/react";
import { Badge, SourceModeBadge } from "@/components/Badge";
import { SeveritySignal } from "@/components/SeveritySignal";
import { labelize } from "@/lib/formatters";
import {
  getSourceModes,
  scanStatusTone,
  summarizeSourceModes,
} from "@/lib/sourceModes";
import type {
  BrightDataTrace,
  ScanStatusResponse,
  SourceMode,
  VendorReviewBrief,
} from "@/lib/types";

export function RiskAssessmentBrief({
  brief,
  scan,
  traces,
  loading,
  error,
  companyName,
  onRequestHtml,
}: {
  brief: VendorReviewBrief | null;
  scan: ScanStatusResponse | null;
  traces: BrightDataTrace[];
  loading: boolean;
  error: string | null;
  companyName: string;
  onRequestHtml: () => Promise<VendorReviewBrief>;
}) {
  const sections = parseBriefSections(brief?.content ?? "");
  const sourceSummary = summarizeSourceModes(traces, scan?.mode);
  const sourceModes = getSourceModes(traces);
  const evidenceSection = sections.find((section) => section.title === "Evidence Table");
  const evidenceRowCount = evidenceSection?.lines
    ? Math.max(parseTableRows(evidenceSection.lines).length, 0)
    : 0;
  const [exportError, setExportError] = useState<string | null>(null);
  const [htmlExporting, setHtmlExporting] = useState(false);

  function downloadBrief(exportBrief: VendorReviewBrief) {
    if (!exportBrief.content) return;
    const downloadContent =
      exportBrief.format === "html"
        ? buildShareableHtmlDocument(exportBrief.content, companyName)
        : exportBrief.content;

    const blob = new Blob([downloadContent], {
      type:
        exportBrief.format === "html"
          ? "text/html;charset=utf-8"
          : "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const extension = exportBrief.format === "html" ? "html" : "md";
    anchor.href = url;
    anchor.download = `${slugify(companyName)}-vendor-risk-brief.${extension}`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function handleHtmlExport() {
    setHtmlExporting(true);
    setExportError(null);
    try {
      downloadBrief(await onRequestHtml());
    } catch (requestError) {
      setExportError(
        requestError instanceof Error
          ? requestError.message
          : "HTML brief export failed.",
      );
    } finally {
      setHtmlExporting(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-soft xl:sticky xl:top-5 xl:max-h-[calc(100dvh-2.5rem)] xl:overflow-y-auto">
      <div className="border-b border-zinc-100 bg-zinc-50/80 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileText size={18} weight="duotone" className="text-signal-700" />
              <h2 className="text-sm font-semibold text-ink-950">
                Vendor Risk Assessment Brief
              </h2>
            </div>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              {brief
                ? `${labelize(brief.format)} brief for scan ${brief.scan_id}.`
                : "Generated after verified evidence reaches the brief stage."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => brief && downloadBrief(brief)}
              disabled={!brief?.content}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-600 transition hover:border-zinc-300 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Export Markdown brief"
              title="Download Markdown brief"
            >
              <DownloadSimple size={14} weight="bold" />
              MD
            </button>
            <button
              type="button"
              onClick={() => void handleHtmlExport()}
              disabled={!brief?.content || htmlExporting}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-600 transition hover:border-zinc-300 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Export HTML brief"
              title="Download HTML brief"
            >
              <DownloadSimple size={14} weight="bold" />
              {htmlExporting ? "..." : "HTML"}
            </button>
          </div>
        </div>

        {brief ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <BriefMetric label="Evidence basis" value="Verified only" />
            <BriefMetric label="Verified rows" value={String(evidenceRowCount)} />
            <BriefMetric label="Source mode" value={sourceSummary.label} />
          </div>
        ) : null}
      </div>

      <div className="p-4">
        {loading ? (
          <BriefSkeleton />
        ) : error ? (
          <StatePanel tone="danger" title="Brief unavailable" body={error} />
        ) : brief ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="good">verified evidence only</Badge>
              {scan ? (
                <Badge tone={scanStatusTone(scan.status)}>
                  {labelize(scan.status)}
                </Badge>
              ) : null}
              <Badge tone={sourceSummary.tone}>{sourceSummary.label}</Badge>
              {sourceModes.map((mode) => (
                <SourceModeBadge key={mode} mode={mode} />
              ))}
            </div>
            <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-600">
              {sourceSummary.detail}
            </p>
            {exportError ? (
              <p className="rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {exportError}
              </p>
            ) : null}
            <div className="divide-y divide-zinc-100">
              {sections.map((section) => (
                <article key={section.title} className="py-4 first:pt-0 last:pb-0">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                    {section.title}
                  </h3>
                  {isMarkdownTable(section.lines) ? (
                    <BriefEvidenceTable lines={section.lines} />
                  ) : (
                    <BriefSectionBody lines={section.lines} />
                  )}
                </article>
              ))}
            </div>
          </div>
        ) : (
          <StatePanel
            tone="neutral"
            title="Brief not generated yet"
            body={
              scan
                ? "The review has not returned a brief for this scan yet."
                : "Enable the agent and let the review reach the Brief stage."
            }
          />
        )}
      </div>
    </section>
  );
}

function BriefMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold leading-5 text-ink-950">{value}</p>
    </div>
  );
}

function BriefSectionBody({ lines }: { lines: string[] }) {
  return (
    <div className="mt-3 space-y-2 text-sm leading-6 text-ink-900">
      {lines.map((line) =>
        line.startsWith("- ") ? (
          <p key={line} className="flex gap-2 text-zinc-700">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-signal-600" />
            <span>{line.slice(2)}</span>
          </p>
        ) : (
          <p key={line}>{line}</p>
        ),
      )}
    </div>
  );
}

function BriefEvidenceTable({ lines }: { lines: string[] }) {
  const headings = parseTableRow(lines[0]);
  const rows = parseTableRows(lines);

  return (
    <div className="mt-3 space-y-3">
      {rows.map((row, rowIndex) => (
        <BriefEvidenceRow
          key={row.join("|") || rowIndex}
          headings={headings}
          row={row}
        />
      ))}
    </div>
  );
}

function BriefEvidenceRow({
  headings,
  row,
}: {
  headings: string[];
  row: string[];
}) {
  const values = Object.fromEntries(
    headings.map((heading, index) => [heading.toLowerCase(), row[index] ?? ""]),
  );
  const mode = values.mode;
  const support = values.support;
  const source = values.source;
  const severity = values.severity;

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3 shadow-[0_14px_28px_-24px_rgba(24,24,27,0.45)] transition hover:border-zinc-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
            Signal
          </p>
          <p className="mt-1 text-sm font-semibold leading-5 text-ink-950">
            {values.signal}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SeveritySignal severity={severity} size="compact" />
          {isSourceMode(mode) ? <SourceModeBadge mode={mode} /> : null}
          <Badge tone={support === "verified" ? "good" : "neutral"}>
            {support || "unknown"}
          </Badge>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(220px,0.9fr)]">
        <BriefEvidenceField label="Source">
          {/^https?:\/\//.test(source) ? (
            <a
              href={source}
              target="_blank"
              rel="noreferrer"
              className="break-all font-mono text-[11px] leading-5 text-signal-700 underline decoration-signal-100 underline-offset-2 hover:text-signal-600"
            >
              {source}
            </a>
          ) : (
            source || "Not available"
          )}
        </BriefEvidenceField>
        <BriefEvidenceField label="Recommended action">
          {values["recommended action"] || "Await verified source support."}
        </BriefEvidenceField>
      </div>
    </div>
  );
}

function BriefEvidenceField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
        {label}
      </p>
      <div className="mt-1 text-sm leading-6 text-zinc-700">{children}</div>
    </div>
  );
}

function parseTableRows(lines: string[]) {
  return lines.slice(2).map(parseTableRow);
}

function isSourceMode(value: string): value is SourceMode {
  return value === "live" || value === "cached" || value === "fallback";
}

function buildShareableHtmlDocument(articleHtml: string, companyName: string) {
  const title = `${companyName} Vendor Risk Assessment Brief`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #171717;
      --muted: #5f6368;
      --line: #e4e4e7;
      --soft: #f7f7f4;
      --signal: #1d5547;
      --signal-soft: #dcece7;
      --caution-soft: #fff8ed;
      --severity-low-bg: #fde68a;
      --severity-low-border: #eab308;
      --severity-low-ink: #713f12;
      --severity-medium-bg: #fed7aa;
      --severity-medium-border: #f97316;
      --severity-medium-ink: #7c2d12;
      --severity-high-bg: #fecdd3;
      --severity-high-border: #fb7185;
      --severity-high-ink: #881337;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--soft);
      color: var(--ink);
      font-family: Geist, Satoshi, Aptos, "Segoe UI", Arial, sans-serif;
      line-height: 1.55;
    }
    main {
      max-width: 960px;
      margin: 0 auto;
      padding: 40px 24px;
    }
    article {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 40px;
      box-shadow: 0 24px 60px -42px rgba(23, 23, 23, 0.45);
    }
    h1 {
      margin: 0 0 28px;
      max-width: 760px;
      font-size: 34px;
      line-height: 1.08;
      letter-spacing: 0;
    }
    h2 {
      margin: 32px 0 10px;
      border-top: 1px solid var(--line);
      padding-top: 20px;
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }
    p, li {
      font-size: 14px;
    }
    ul {
      margin: 10px 0 0;
      padding-left: 20px;
    }
    table {
      width: 100%;
      margin-top: 14px;
      border-collapse: separate;
      border-spacing: 0;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 10px;
      font-size: 12px;
    }
    th {
      background: #fafafa;
      color: var(--muted);
      font-size: 11px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    th, td {
      padding: 12px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }
    tr:last-child td {
      border-bottom: 0;
    }
    td:nth-child(3), td:nth-child(4) {
      white-space: nowrap;
      font-weight: 700;
      color: var(--signal);
    }
    td:nth-child(5) {
      overflow-wrap: anywhere;
      font-family: "Geist Mono", "JetBrains Mono", "Cascadia Code", Consolas, monospace;
      font-size: 11px;
    }
    .severity {
      display: inline-flex;
      min-width: 52px;
      min-height: 28px;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--severity-low-border);
      border-radius: 8px;
      background: var(--severity-low-bg);
      padding: 6px 8px;
      color: var(--severity-low-ink);
      font-size: 10.5px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .severity-high {
      border-color: var(--severity-high-border);
      background: var(--severity-high-bg);
      color: var(--severity-high-ink);
    }
    .severity-medium {
      border-color: var(--severity-medium-border);
      background: var(--severity-medium-bg);
      color: var(--severity-medium-ink);
    }
    .severity-low {
      border-color: var(--severity-low-border);
      background: var(--severity-low-bg);
      color: var(--severity-low-ink);
    }
    a {
      color: var(--signal);
      text-underline-offset: 2px;
    }
    @media print {
      body { background: #fff; }
      main { max-width: none; padding: 0; }
      article { border: 0; border-radius: 0; box-shadow: none; padding: 0; }
      h1 { font-size: 28px; }
      table { page-break-inside: avoid; }
    }
    @media (max-width: 720px) {
      main { padding: 20px 12px; }
      article { padding: 24px; border-radius: 12px; }
      h1 { font-size: 26px; }
      table { display: block; overflow-x: auto; }
    }
  </style>
</head>
<body>
  <main>
    ${articleHtml}
  </main>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function parseBriefSections(markdown: string) {
  return markdown
    .split("\n\n")
    .filter(Boolean)
    .reduce<Array<{ title: string; lines: string[] }>>((sections, block) => {
      if (block.startsWith("# ")) return sections;

      if (block.startsWith("## ")) {
        const [titleLine, ...bodyLines] = block.split("\n");
        sections.push({
          title: titleLine.replace("## ", ""),
          lines: bodyLines.filter(Boolean),
        });
        return sections;
      }

      if (sections.length > 0) {
        sections[sections.length - 1].lines.push(...block.split("\n"));
      }

      return sections;
    }, []);
}

function isMarkdownTable(lines: string[]) {
  return (
    lines.length >= 2 &&
    lines[0].trim().startsWith("|") &&
    /^\|(?:\s*:?-+:?\s*\|)+$/.test(lines[1].trim())
  );
}

function parseTableRow(line: string) {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

function BriefSkeleton() {
  return (
    <div className="mt-5 space-y-4">
      <div className="flex gap-2">
        <div className="h-6 w-32 animate-pulse rounded-full bg-zinc-100" />
        <div className="h-6 w-40 animate-pulse rounded-full bg-zinc-100" />
      </div>
      {[0, 1, 2].map((item) => (
        <div key={item} className="border-t border-zinc-100 pt-4">
          <div className="h-3 w-28 animate-pulse rounded bg-zinc-100" />
          <div className="mt-3 h-4 w-full animate-pulse rounded bg-zinc-100" />
          <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-zinc-100" />
        </div>
      ))}
    </div>
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
      className={`mt-5 rounded-md border p-5 text-sm ${
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
