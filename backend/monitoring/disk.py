from __future__ import annotations

import psutil

from backend.app.core.logging import logger


def snapshot() -> dict:
    partitions: list[dict] = []
    total = used = free = 0

    try:
        for part in psutil.disk_partitions(all=False):
            if part.fstype and part.mountpoint:
                try:
                    usage = psutil.disk_usage(part.mountpoint)
                except PermissionError:
                    continue
                partitions.append(
                    {
                        "device": part.device,
                        "mountpoint": part.mountpoint,
                        "totalBytes": int(usage.total),
                        "usedBytes": int(usage.used),
                        "freeBytes": int(usage.free),
                        "usagePercent": round(float(usage.percent), 2),
                    }
                )
                if part.mountpoint in ("/", "C:\\", "C:/"):
                    total = int(usage.total)
                    used = int(usage.used)
                    free = int(usage.free)
    except Exception as exc:
        logger.debug("Disk metrics failed: %s", exc)

    if total == 0 and partitions:
        primary = partitions[0]
        total = primary["totalBytes"]
        used = primary["usedBytes"]
        free = primary["freeBytes"]

    usage_percent = round((used / total) * 100, 2) if total else 0.0

    return {
        "totalBytes": total,
        "usedBytes": used,
        "freeBytes": free,
        "usagePercent": usage_percent,
        "partitions": partitions,
    }
