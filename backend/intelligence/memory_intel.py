from __future__ import annotations

import psutil

from backend.app.core.logging import logger
from backend.intelligence.platform_win import read_memory_extended


def _build_memory_summary(metrics: dict, analysis: dict, delta_pct: float | None) -> str:
    pct = float(metrics.get("usagePercent", 0))
    pressure = metrics.get("pressure", "unknown")
    parts = [f"Memory usage is {pct:.0f}% ({pressure} pressure)."]
    if delta_pct is not None and delta_pct >= 5:
        parts.append(f"Usage increased ~{delta_pct:.0f}% compared to the last hour average.")
    elif delta_pct is not None and delta_pct <= -5:
        parts.append(f"Usage decreased ~{abs(delta_pct):.0f}% compared to the last hour average.")
    top = metrics.get("topProcesses") or []
    if top:
        leader = top[0]
        mem_mb = int(leader.get("memoryBytes", 0)) // (1024 * 1024)
        parts.append(f"Largest consumer: {leader.get('name')} at ~{mem_mb} MB RSS.")
    reclaimable = metrics.get("reclaimableEstimateBytes")
    if reclaimable and int(reclaimable) > 256 * 1024 * 1024:
        parts.append(f"Estimated reclaimable from cached/standby memory: ~{int(reclaimable) // (1024**3)} GB (platform estimate).")
    return " ".join(parts)


def collect(process_items: list[dict] | None = None, *, history_delta_pct: float | None = None) -> dict:
    try:
        vm = psutil.virtual_memory()
        swap = psutil.swap_memory()
    except Exception as exc:
        logger.debug("Memory intelligence failed: %s", exc)
        return {
            "totalBytes": 0,
            "usedBytes": 0,
            "availableBytes": 0,
            "usagePercent": 0.0,
            "topProcesses": [],
            "pressure": "unknown",
            "aiSummary": "Memory metrics unavailable.",
        }

    extended = read_memory_extended()
    cached = int(getattr(vm, "cached", 0) or 0)
    if not cached and hasattr(vm, "buffers"):
        cached = int(getattr(vm, "buffers", 0) or 0)

    pct = round(float(vm.percent), 2)
    pressure = "low"
    if pct >= 90:
        pressure = "critical"
    elif pct >= 75:
        pressure = "high"
    elif pct >= 60:
        pressure = "moderate"

    top = []
    if process_items:
        top = sorted(process_items, key=lambda p: int(p.get("memoryBytes", 0)), reverse=True)[:10]

    reclaimable = cached
    if extended.get("pageFileUsedBytes"):
        pass  # page file used is committed, not reclaimable

    metrics = {
        "totalBytes": int(vm.total),
        "usedBytes": int(vm.used),
        "availableBytes": int(vm.available),
        "usagePercent": pct,
        "cachedBytes": cached,
        "committedBytes": int(getattr(vm, "active", vm.used)),
        "workingSetBytes": extended.get("workingSetBytes") or int(vm.used),
        "privateBytes": int(getattr(vm, "used", 0)),
        "virtualTotalBytes": extended.get("virtualTotalBytes") or int(getattr(vm, "total", 0)),
        "virtualFreeBytes": extended.get("virtualFreeBytes"),
        "pageFileTotalBytes": extended.get("pageFileTotalBytes") or int(swap.total),
        "pageFileUsedBytes": extended.get("pageFileUsedBytes") or int(swap.used),
        "swapTotalBytes": int(swap.total),
        "swapUsedBytes": int(swap.used),
        "swapUsagePercent": round(float(swap.percent), 2) if swap.total else 0.0,
        "reclaimableEstimateBytes": reclaimable,
        "topProcesses": [
            {"pid": p["pid"], "name": p["name"], "memoryBytes": p["memoryBytes"]} for p in top
        ],
        "pressure": pressure,
    }
    metrics["aiSummary"] = _build_memory_summary(metrics, {}, history_delta_pct)
    return metrics
