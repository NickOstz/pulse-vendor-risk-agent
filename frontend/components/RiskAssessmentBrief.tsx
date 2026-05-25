import { DownloadSimple, FileText } from "@phosphor-icons/react";
import { Badge } from "@/components/Badge";
import type { VendorReviewBrief } from "@/lib/types";

export function RiskAssessmentBrief({
  brief,
}: {
  brief: VendorReviewBrief | null;
}) {
  const sections = parseBriefSections(brief?.content ?? "");

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
            Markdown fixture rendered as a readable review artifact.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition hover:border-zinc-300 active:scale-[0.96]"
          aria-label="Export brief"
        >
          <DownloadSimple size={16} weight="bold" />
        </button>
      </div>

      {brief ? (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="good">verified evidence only</Badge>
            <Badge tone="warn">completed with fallback</Badge>
          </div>
          {sections.map((section) => (
            <article key={section.title} className="border-t border-zinc-100 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                {section.title}
              </h3>
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
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-md border border-dashed border-zinc-300 p-5 text-sm text-zinc-500">
          Brief will render after the review reaches the Brief stage.
        </div>
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
