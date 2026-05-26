from collections.abc import Iterable
from html import escape

from app.models import BrightDataTrace, Company, EvidenceItem


SIGNAL_LABELS = {
    "trust_security": "Trust / security",
    "pricing_terms": "Pricing / terms",
    "adverse_media": "Operational / adverse media",
}
SOURCE_MODE_PRIORITY = {"live": 3, "fallback": 2, "cached": 1}


def render_vendor_review_brief(
    company: Company,
    evidence_items: Iterable[EvidenceItem],
    traces: Iterable[BrightDataTrace],
) -> tuple[str, str]:
    verified_items = [item for item in evidence_items if item.support_status == "verified"]
    modes_by_url = _source_modes_by_url(traces)
    modes = [_evidence_mode(item, modes_by_url) for item in verified_items]
    mode_summary = _mode_summary(modes)

    summary = (
        f"{company.name} is a {company.criticality} {company.relationship_type} vendor with renewal on "
        f"{company.renewal_date.isoformat()}. Pulse assembled {mode_summary} from public sources for "
        "renewal review."
    )
    interpretation = (
        "These verified public statements are review triggers, not proof of a control failure or unresolved "
        "incident. Security and Procurement should confirm assurance documentation, commercial scope, and "
        "any operational impact before renewal."
    )
    status = (
        f"Needs review before renewal. This brief includes only verified evidence: {mode_summary}. "
        "Live, fallback, and cached labels identify how each source was obtained."
    )

    markdown_lines = [
        f"# Vendor Risk Assessment Brief: {company.name}",
        "",
        "## Summary",
        summary,
        "",
        "## Key Verified Changes",
    ]
    if verified_items:
        for item in verified_items:
            markdown_lines.append(f"- {_signal_label(item)}: {item.claim}")
    else:
        markdown_lines.append("- No verified public-source change was available for assessment.")

    markdown_lines.extend(
        [
            "",
            "## Evidence Table",
            "| Signal | Mode | Support | Source | Recommended action |",
            "| --- | --- | --- | --- | --- |",
        ]
    )
    for item in verified_items:
        markdown_lines.append(
            f"| {_markdown_cell(_signal_label(item))} | {_markdown_cell(_evidence_mode(item, modes_by_url))} "
            f"| verified | {_markdown_cell(item.source_url)} | {_markdown_cell(item.recommended_action)} |"
        )
    if not verified_items:
        markdown_lines.append("| No verified evidence | n/a | n/a | n/a | Await verified source support. |")

    markdown_lines.extend(
        [
            "",
            "## Risk Interpretation",
            interpretation,
            "",
            "## Recommended Action",
        ]
    )
    if verified_items:
        markdown_lines.extend(f"- {item.recommended_action}" for item in verified_items)
    else:
        markdown_lines.append("- Do not escalate until public-source evidence verifies.")
    markdown_lines.extend(
        [
            "",
            "## Suggested Owner",
            f"{company.owner}, with Procurement support.",
            "",
            "## Review Status",
            status,
        ]
    )

    html_rows = "".join(
        "<tr>"
        f"<td>{escape(_signal_label(item))}</td>"
        f"<td>{escape(_evidence_mode(item, modes_by_url))}</td>"
        "<td>verified</td>"
        f'<td><a href="{escape(item.source_url)}">{escape(item.source_url)}</a></td>'
        f"<td>{escape(item.recommended_action)}</td>"
        "</tr>"
        for item in verified_items
    )
    if not html_rows:
        html_rows = (
            "<tr><td>No verified evidence</td><td>n/a</td><td>n/a</td><td>n/a</td>"
            "<td>Await verified source support.</td></tr>"
        )
    html_changes = "".join(f"<li>{escape(item.claim)}</li>" for item in verified_items)
    if not html_changes:
        html_changes = "<li>No verified public-source change was available for assessment.</li>"
    html_actions = "".join(f"<li>{escape(item.recommended_action)}</li>" for item in verified_items)
    if not html_actions:
        html_actions = "<li>Do not escalate until public-source evidence verifies.</li>"

    html = (
        f"<article><h1>Vendor Risk Assessment Brief: {escape(company.name)}</h1>"
        f"<h2>Summary</h2><p>{escape(summary)}</p>"
        f"<h2>Key Verified Changes</h2><ul>{html_changes}</ul>"
        "<h2>Evidence Table</h2><table><thead><tr><th>Signal</th><th>Mode</th><th>Support</th>"
        "<th>Source</th><th>Recommended action</th></tr></thead>"
        f"<tbody>{html_rows}</tbody></table>"
        f"<h2>Risk Interpretation</h2><p>{escape(interpretation)}</p>"
        f"<h2>Recommended Action</h2><ul>{html_actions}</ul>"
        f"<h2>Suggested Owner</h2><p>{escape(company.owner)}, with Procurement support.</p>"
        f"<h2>Review Status</h2><p>{escape(status)}</p></article>"
    )
    return "\n".join(markdown_lines), html


def _source_modes_by_url(traces: Iterable[BrightDataTrace]) -> dict[str, set[str]]:
    modes: dict[str, set[str]] = {}
    for trace in traces:
        if not trace.source_url:
            continue
        modes.setdefault(trace.source_url, set()).add(trace.source_mode)
    return modes


def _evidence_mode(item: EvidenceItem, modes_by_url: dict[str, set[str]]) -> str:
    available_modes = modes_by_url.get(item.source_url, set())
    snapshot_path = (item.snapshot_path or "").replace("\\", "/")
    if "cached_sources/" in snapshot_path:
        if "fallback" in available_modes:
            return "fallback"
        if "cached" in available_modes:
            return "cached"
    for mode in SOURCE_MODE_PRIORITY:
        if mode in available_modes:
            return mode
    return "cached"


def _mode_summary(modes: list[str]) -> str:
    if not modes:
        return "no verified evidence"
    counts = [(mode, modes.count(mode)) for mode in ("live", "fallback", "cached") if mode in modes]
    phrases = [f"{count} {mode}" for mode, count in counts]
    if len(phrases) == 1:
        modes_text = phrases[0]
    elif len(phrases) == 2:
        modes_text = f"{phrases[0]} and {phrases[1]}"
    else:
        modes_text = ", ".join(phrases[:-1]) + f", and {phrases[-1]}"
    return f"{modes_text} verified public-source signal{'s' if len(modes) != 1 else ''}"


def _signal_label(item: EvidenceItem) -> str:
    return SIGNAL_LABELS.get(item.signal_type, item.signal_type.replace("_", " ").title())


def _markdown_cell(value: str) -> str:
    return value.replace("|", r"\|").replace("\n", " ")
