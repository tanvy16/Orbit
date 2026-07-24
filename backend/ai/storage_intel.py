from __future__ import annotations

import json
import platform
import shutil
import subprocess

from backend.app.core.logging import logger


def _format_bytes(num: int) -> str:
    if num < 1024**3:
        return f"{num / 1024**3:.2f} GB"
    return f"{num / 1024**3:.1f} GB"


def _read_windows_disk_health() -> str | None:
    if platform.system() != "Windows":
        return None
    try:
        result = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "Get-PhysicalDisk | Select-Object FriendlyName,HealthStatus,OperationalStatus | Format-List",
            ],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        if result.stdout.strip():
            return result.stdout.strip()[:900]
    except Exception as exc:
        logger.debug("Windows disk health query failed: %s", exc)
    return None


def read_smart_summary() -> str | None:
    windows = _read_windows_disk_health()
    if windows:
        return windows
    if not shutil.which("smartctl"):
        return None
    try:
        result = subprocess.run(
            ["smartctl", "-H", "/dev/sda"],
            capture_output=True,
            text=True,
            timeout=4,
            check=False,
        )
        if result.stdout.strip():
            return result.stdout.strip()[:800]
    except Exception as exc:
        logger.debug("smartctl unavailable: %s", exc)
    return None


def build_storage_context(disk: dict) -> str:
    used_pct = float(disk.get("usagePercent", 0))
    free = int(disk.get("freeBytes", 0))
    total = int(disk.get("totalBytes", 0))

    warnings: list[str] = []
    if used_pct >= 92:
        warnings.append("Critical: storage is nearly full")
    elif used_pct >= 85:
        warnings.append("Warning: low free space may slow the system")

    smart = read_smart_summary()
    smart_line = smart if smart else "SMART / physical disk health data not available on this system."

    return f"""Storage usage: {used_pct:.0f}% ({_format_bytes(total - free)} used, {_format_bytes(free)} free)
Alerts: {', '.join(warnings) if warnings else 'none'}
Disk health:
{smart_line}
"""
