from rapidfuzz import fuzz


QUOTE_MATCH_THRESHOLD = 0.8


def normalize_text(value: str) -> str:
    return " ".join(value.casefold().split())


def verify_quote(source_text: str, quote: str) -> tuple[str, float]:
    normalized_source = normalize_text(source_text)
    normalized_quote = normalize_text(quote)
    if not normalized_source or not normalized_quote:
        return "needs_review", 0.0
    if normalized_quote in normalized_source:
        return "verified", 1.0

    score = fuzz.partial_ratio(normalized_quote, normalized_source) / 100
    status = "verified" if score >= QUOTE_MATCH_THRESHOLD else "needs_review"
    return status, round(score, 4)
