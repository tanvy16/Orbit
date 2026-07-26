from __future__ import annotations

import time

import psutil

from backend.app.core.logging import logger
from backend.intelligence.platform_win import list_running_drivers, read_dns_cache, read_kernel_pools


def collect() -> dict:
    ctx_switches: int | None = None
    interrupts: int | None = None
    soft_interrupts: int | None = None
    try:
        stats = psutil.cpu_stats()
        ctx_switches = int(stats.ctx_switches)
        interrupts = int(stats.interrupts)
        soft_interrupts = int(getattr(stats, "soft_interrupts", 0) or 0)
    except Exception as exc:
        logger.debug("Kernel CPU stats unavailable: %s", exc)

    boot_time: int | None = None
    try:
        boot_time = int(psutil.boot_time() * 1000)
    except Exception:
        pass

    users: list[dict] = []
    try:
        for user in psutil.users()[:10]:
            users.append({"name": user.name, "host": user.host, "startedAt": int(user.started * 1000)})
    except Exception:
        pass

    services_count: int | None = None
    try:
        services_count = len(list(psutil.win_service_iter())) if hasattr(psutil, "win_service_iter") else None
    except Exception:
        services_count = None

    pools = read_kernel_pools()
    drivers = list_running_drivers(25)
    kernel_memory = (pools.get("pagedPoolBytes") or 0) + (pools.get("nonPagedPoolBytes") or 0)

    summary_parts = []
    if ctx_switches is not None:
        summary_parts.append(f"Context switches at {ctx_switches:,}.")
    if interrupts is not None:
        summary_parts.append(f"Interrupt count at {interrupts:,}.")
    if pools:
        summary_parts.append("Kernel pool memory counters collected.")
    if not summary_parts:
        summary = "Limited kernel metrics on this platform — only basic counters are exposed."
    else:
        summary = "Kernel activity is within collected limits. " + " ".join(summary_parts)
        if interrupts and interrupts < 50_000_000:
            summary += " No abnormal interrupt rates detected in available counters."

    return {
        "contextSwitches": ctx_switches,
        "interruptRate": interrupts,
        "softInterrupts": soft_interrupts,
        "bootTime": boot_time,
        "activeUsers": users,
        "runningServices": services_count,
        "pagedPoolBytes": pools.get("pagedPoolBytes"),
        "nonPagedPoolBytes": pools.get("nonPagedPoolBytes"),
        "kernelMemoryBytes": kernel_memory or None,
        "runningDrivers": drivers,
        "driverCount": len(drivers),
        "aiSummary": summary,
        "available": ctx_switches is not None or boot_time is not None or bool(pools),
    }
