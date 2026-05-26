"use client";

import { useState } from "react";
import { DownloadSimple, FileText } from "@phosphor-icons/react";
import { Badge } from "@/components/Badge";
import { SourceModeBadge } from "@/components/Badge";
import { labelize } from "@/lib/formatters";
import {
  getSourceModes,
  scanStatusTone,
  summarizeSourceModes,
} from "@/lib/sourceModes";
import type {
  BrightDataTrace,
  ScanStatusResponse,
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
  const [exportError, setExportError] = useState<string | null>(null);
  const [htmlExporting, setHtmlExporting] = useState(false);

  function downloadBrief(exportBrief: VendorReviewBrief) {
    if (!exportBrief.content) return;

    const blob = new Blob([exportBrief.content], {
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
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileText size={18} weight="duotone" className="text-signal-700" />
            <h2 className="text-sm font-semibold text-ink-950">
              Vendor Risk Assessment Brief
            </h2>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
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

      {loading ? (
        <BriefSkeleton />
      ) : error ? (
        <StatePanel tone="danger" title="Brief unavailable" body={error} />
      ) : brief ? (
        <div className="mt-5 space-y-4">
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
          {sections.map((section) => (
            <article key={section.title} className="border-t border-zinc-100 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                {section.title}
              </h3>
              {isMarkdownTable(section.lines) ? (
                <BriefEvidenceTable lines={section.lines} />
              ) : (
                <div className="mt-2 space-y-2 text-sm leading-6 text-ink-900">
                  {section.lines.map((line) =>
                    line.startsWith("- ") ? (
                      <p key={line} className="pl-3 text-zinc-700">
                        <span className="mr-2 text-signal-700">-</span>{" "}
                        {line.slice(2)}
                      </p>
                    ) : (
                      <p key={line}>{line}</p>
                    ),
                  )}
                </div>
              )}
            </article>
          ))}
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
    </section>
  );
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

function BriefEvidenceTable({ lines }: { lines: string[] }) {
  const headings = parseTableRow(lines[0]);
  const rows = lines.slice(2).map(parseTableRow);

  return (
    <div className="mt-3 overflow-x-auto rounded-md border border-zinc-200">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-zinc-50 text-zinc-500">
          <tr>
            {headings.map((heading) => (
              <th key={heading} className="px-3 py-2 font-medium">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((row, rowIndex) => (
            <tr key={row.join("|") || rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={`${cellIndex}-${cell}`} className="px-3 py-3 align-top text-zinc-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
