from __future__ import annotations

import shutil
import subprocess
import time

from backend.app.core.logging import logger

_prev_io: dict[str, int] | None = None
_prev_io_at: float = 0.0


def _disk_io_rates() -> dict[str, float | None]:
    global _prev_io, _prev_io_at
    import psutil

    try:
        counters = psutil.disk_io_counters()
        if not counters:
            return {"readBytesPerSec": None, "writeBytesPerSec": None}
        now = time.time()
        current = {
            "read": int(counters.read_bytes),
            "write": int(counters.write_bytes),
        }
        if _prev_io and now > _prev_io_at:
            elapsed = now - _prev_io_at
            read_rate = max(0, (current["read"] - _prev_io["read"]) / elapsed)
            write_rate = max(0, (current["write"] - _prev_io["write"]) / elapsed)
            _prev_io = current
            _prev_io_at = now
            return {"readBytesPerSec": round(read_rate, 2), "writeBytesPerSec": round(write_rate, 2)}
        _prev_io = current
        _prev_io_at = now
        return {"readBytesPerSec": 0.0, "writeBytesPerSec": 0.0}
    except Exception as exc:
        logger.debug("Disk IO rates failed: %s", exc)
        return {"readBytesPerSec": None, "writeBytesPerSec": None}


def snapshot() -> dict:
    import psutil

    partitions: list[dict] = []
    total = used = free = 0
    file_system = None

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
                        "fstype": part.fstype,
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
                    file_system = part.fstype
    except Exception as exc:
        logger.debug("Disk metrics failed: %s", exc)

    if total == 0 and partitions:
        primary = partitions[0]
        total = primary["totalBytes"]
        used = primary["usedBytes"]
        free = primary["freeBytes"]
        file_system = primary.get("fstype")

    usage_percent = round((used / total) * 100, 2) if total else 0.0
    io_rates = _disk_io_rates()

    return {
        "totalBytes": total,
        "usedBytes": used,
        "freeBytes": free,
        "usagePercent": usage_percent,
        "fileSystem": file_system,
        "readBytesPerSec": io_rates.get("readBytesPerSec"),
        "writeBytesPerSec": io_rates.get("writeBytesPerSec"),
        "partitions": partitions,
    }
