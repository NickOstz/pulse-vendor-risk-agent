from dataclasses import dataclass
from typing import Protocol

from app.models import Company, Scan


@dataclass(frozen=True)
class PipelineResult:
    status: str
    evidence_count: int
    verified_count: int
    source_count: int


class CollectionService(Protocol):
    """Integration hook for live Bright Data collection."""

    def collect(self, company: Company, scan: Scan) -> PipelineResult:
        ...


class ExtractionService(Protocol):
    """Integration hook for LLM-backed structured extraction."""

    def extract(self, company: Company, scan: Scan) -> PipelineResult:
        ...


class VerificationService(Protocol):
    """Integration hook for deterministic quote verification."""

    def verify(self, company: Company, scan: Scan) -> PipelineResult:
        ...


class ScoringService(Protocol):
    """Integration hook for deterministic scoring and related-change cards."""

    def score(self, company: Company, scan: Scan) -> PipelineResult:
        ...


class BriefService(Protocol):
    """Integration hook for live brief rendering from verified evidence."""

    def render(self, company: Company, scan: Scan) -> PipelineResult:
        ...
