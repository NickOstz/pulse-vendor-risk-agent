from typing import Literal

from sqlmodel import Session, select

from app.models import EvidenceItem, Scan

ChangeStatus = Literal["baseline", "changed", "unchanged"]


def classify_live_evidence_changes(
    session: Session,
    scan: Scan,
    evidence_items: list[EvidenceItem],
) -> dict[str, ChangeStatus]:
    previous_scan = session.exec(
        select(Scan)
        .where(
            Scan.company_id == scan.company_id,
            Scan.id != scan.id,
            Scan.completed_at != None,  # noqa: E711
            Scan.started_at < scan.started_at,
        )
        .order_by(Scan.started_at.desc())
    ).first()
    if previous_scan is None:
        return {item.id: "baseline" for item in evidence_items}

    previous_items = session.exec(
        select(EvidenceItem).where(
            EvidenceItem.scan_id == previous_scan.id,
            EvidenceItem.support_status == "verified",
        )
    ).all()
    previous_by_source_signal = {
        (item.source_url, item.signal_type): item for item in previous_items
    }
    statuses: dict[str, ChangeStatus] = {}
    for item in evidence_items:
        previous = previous_by_source_signal.get((item.source_url, item.signal_type))
        if previous is None:
            statuses[item.id] = "changed"
        elif _normalized(previous.supporting_quote) == _normalized(item.supporting_quote):
            statuses[item.id] = "unchanged"
        else:
            statuses[item.id] = "changed"
    return statuses


def _normalized(value: str) -> str:
    return " ".join(value.casefold().split())
