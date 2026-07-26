from __future__ import annotations

import psutil

from backend.app.core.logging import logger
from backend.monitoring import cpu as cpu_monitor


def _build_cpu_summary(metrics: dict, top_processes: list[dict]) -> str:
    usage = float(metrics.get("usagePercent", 0))
    parts = [f"Overall CPU usage is {usage:.0f}%."]
    if top_processes:
        names = [f"{p.get('name')} ({p.get('cpuPercent')}%)" for p in top_processes[:3]]
        parts.append(f"Top consumers: {', '.join(names)}.")
    pressure = "elevated" if usage >= 70 else "moderate" if usage >= 45 else "low"
    parts.append(f"Load is {pressure} relative to typical desktop operation.")
    if len(top_processes) >= 2 and float(top_processes[0].get("cpuPercent", 0)) >= 20 and float(top_processes[1].get("cpuPercent", 0)) >= 15:
        parts.append(
            f"Usage appears driven by concurrent activity from {top_processes[0].get('name')} and {top_processes[1].get('name')}."
        )
    elif usage < 85:
        parts.append("Usage remains within expected operating limits.")
    return " ".join(parts)


def collect(top_processes: list[dict] | None = None) -> dict:
    base = cpu_monitor.snapshot()
    physical = psutil.cpu_count(logical=False) or 0
    logical = psutil.cpu_count(logical=True) or base.get("coreCount", 0)

    ctx_switches: int | None = None
    interrupts: int | None = None
    try:
        stats = psutil.cpu_stats()
        ctx_switches = int(stats.ctx_switches)
        interrupts = int(stats.interrupts)
    except Exception as exc:
        logger.debug("CPU stats unavailable: %s", exc)

    uptime_seconds = 0
    try:
        uptime_seconds = max(0, int(__import__("time").time() - psutil.boot_time()))
    except Exception:
        pass

    process_count = 0
    thread_count = 0
    try:
        process_count = len(psutil.pids())
        for proc in psutil.process_iter(["num_threads"]):
            try:
                thread_count += int(proc.info.get("num_threads") or 0)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
            if thread_count > 50000:
                break
    except Exception:
        pass

    top = top_processes or []
    return {
        **base,
        "physicalCores": physical,
        "logicalCores": logical,
        "contextSwitches": ctx_switches,
        "interruptRate": interrupts,
        "processCount": process_count,
        "threadCount": thread_count,
        "uptimeSeconds": uptime_seconds,
        "aiSummary": _build_cpu_summary(base, top),
    }
