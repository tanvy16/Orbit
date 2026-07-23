from __future__ import annotations

import time

import psutil

from backend.app.core.logging import logger

_SCAN_CAP = 60
_TOP_LIMIT = 20


def _format_runtime(seconds: float) -> int:
    return max(0, int(seconds))


def snapshot(limit: int = _TOP_LIMIT) -> dict:
    now = time.time()
    candidates: list[dict] = []

    try:
        total_count = len(psutil.pids())
    except Exception:
        total_count = 0

    try:
        scanned = 0
        for proc in psutil.process_iter(["pid", "name", "memory_info", "create_time"], ad_value=None):
            scanned += 1
            if scanned > _SCAN_CAP:
                break
            try:
                info = proc.info
                mem_info = info.get("memory_info")
                rss = int(getattr(mem_info, "rss", 0) or 0) if mem_info else 0
                create_time = float(info.get("create_time") or now)
                candidates.append(
                    {
                        "pid": int(info.get("pid") or 0),
                        "name": info.get("name") or "unknown",
                        "memoryBytes": rss,
                        "runtimeSeconds": _format_runtime(now - create_time),
                    }
                )
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
    except Exception as exc:
        logger.debug("Process metrics failed: %s", exc)
        return {"count": total_count, "items": []}

    candidates.sort(key=lambda r: r["memoryBytes"], reverse=True)
    top = candidates[:limit]

    for row in top:
        cpu_pct = 0.0
        try:
            cpu_pct = float(psutil.Process(row["pid"]).cpu_percent(interval=0))
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
        row["cpuPercent"] = round(cpu_pct, 2)

    top.sort(key=lambda r: (r["cpuPercent"], r["memoryBytes"]), reverse=True)
    return {"count": total_count, "items": top}
