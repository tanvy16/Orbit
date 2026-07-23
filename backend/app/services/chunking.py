from __future__ import annotations

import re
from typing import Iterable


def chunk_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    cleaned = re.sub(r"\s+", " ", text).strip()
    if not cleaned:
        return []
    if len(cleaned) <= chunk_size:
        return [cleaned]

    chunks: list[str] = []
    start = 0
    while start < len(cleaned):
        end = min(len(cleaned), start + chunk_size)
        chunks.append(cleaned[start:end])
        if end >= len(cleaned):
            break
        start = max(0, end - overlap)
    return chunks


def highlight_snippet(text: str, query: str, radius: int = 120) -> str:
    if not text:
        return ""
    terms = [t for t in re.split(r"\W+", query.lower()) if len(t) > 2]
    lower = text.lower()
    idx = 0
    for term in terms:
        pos = lower.find(term)
        if pos >= 0:
            idx = pos
            break
    start = max(0, idx - radius // 2)
    end = min(len(text), start + radius)
    snippet = text[start:end]
    for term in terms:
        pattern = re.compile(re.escape(term), re.IGNORECASE)
        snippet = pattern.sub(lambda m: f"«{m.group(0)}»", snippet)
    return snippet
