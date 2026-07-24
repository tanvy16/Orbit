from __future__ import annotations

import re
from difflib import get_close_matches

# Abbreviation / typo expansions for document and app-name queries.
_ALIASES: dict[str, str] = {
    "chrom": "chrome",
    "chr": "chrome",
    "ppt": "powerpoint",
    "ppoint": "powerpoint",
    "doc": "document",
    "docs": "documents",
    "pdf": "pdf",
    "xls": "excel spreadsheet",
    "txt": "text file",
    "resume": "resume cv",
    "inv": "invoice",
}

_APP_NAMES = ("chrome", "firefox", "edge", "code", "docker", "spotify", "discord", "slack")


def expand_search_query(message: str) -> str:
    """Expand abbreviations and partial tokens to improve semantic retrieval."""
    text = message.strip()
    if not text:
        return text

    lower = text.lower()
    parts: list[str] = [text]

    for token, expansion in _ALIASES.items():
        if re.search(rf"\b{re.escape(token)}\b", lower):
            parts.append(expansion)

    for app in _APP_NAMES:
        if app in lower or get_close_matches(app, lower.split(), n=1, cutoff=0.75):
            parts.append(app)

    # De-duplicate while preserving order
    seen: set[str] = set()
    merged: list[str] = []
    for part in parts:
        key = part.lower()
        if key not in seen:
            seen.add(key)
            merged.append(part)
    return " ".join(merged)
