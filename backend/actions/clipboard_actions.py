from __future__ import annotations

CLIPBOARD_OPERATIONS = frozenset({"explain", "summarize", "translate", "improve"})


def normalize_clipboard_operation(raw: str) -> str:
    value = raw.strip().lower()
    return value if value in CLIPBOARD_OPERATIONS else "explain"
