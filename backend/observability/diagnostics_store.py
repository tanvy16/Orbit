from __future__ import annotations

import threading
import time
from collections import deque
from typing import Any

_lock = threading.Lock()
_recent: deque[dict[str, Any]] = deque(maxlen=200)


def record_diagnostic(entry: dict[str, Any]) -> None:
    payload = {**entry, "recordedAt": time.time()}
    with _lock:
        _recent.appendleft(payload)


def list_diagnostics(limit: int = 50) -> list[dict[str, Any]]:
    with _lock:
        return list(_recent)[:limit]


def record_copilot_profile(
    *,
    message: str,
    model: str | None,
    profile: dict[str, float | int] | None,
    route: str,
    direct_answer: bool = False,
) -> None:
    record_diagnostic(
        {
            "type": "copilot",
            "message": message[:120],
            "model": model,
            "route": route,
            "directAnswer": direct_answer,
            "profile": profile or {},
        }
    )
