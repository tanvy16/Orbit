from __future__ import annotations

from collections import deque

import psutil

from backend.app.core.logging import logger

_HISTORY_LEN = 60
_usage_history: deque[float] = deque(maxlen=_HISTORY_LEN)


def _record_usage(percent: float) -> None:
    _usage_history.append(round(percent, 2))


def snapshot() -> dict:
    try:
        psutil.cpu_percent(interval=None)
        overall = float(psutil.cpu_percent(interval=0))
    except Exception as exc:
        logger.debug("CPU metrics failed: %s", exc)
        overall = 0.0

    _record_usage(overall)

    per_core: list[float] = []
    try:
        per_core = [round(p, 2) for p in psutil.cpu_percent(interval=0, percpu=True)]
    except Exception:
        per_core = []

    freq_mhz: float | None = None
    try:
        freq = psutil.cpu_freq()
        if freq and freq.current:
            freq_mhz = round(float(freq.current), 1)
    except Exception:
        freq_mhz = None

    return {
        "usagePercent": round(overall, 2),
        "perCorePercent": per_core,
        "frequencyMhz": freq_mhz,
        "coreCount": psutil.cpu_count(logical=True) or 0,
        "loadHistory": list(_usage_history),
    }
