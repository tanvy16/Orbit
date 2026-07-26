from __future__ import annotations

import platform
import subprocess
from typing import Any

from backend.app.core.logging import logger

_IS_WINDOWS = platform.system() == "Windows"


def _powershell(script: str, timeout: float = 5.0) -> str | None:
    if not _IS_WINDOWS:
        return None
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", script],
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except Exception as exc:
        logger.debug("PowerShell query failed: %s", exc)
    return None


def read_memory_extended() -> dict[str, Any]:
    if not _IS_WINDOWS:
        return {}
    raw = _powershell(
        "(Get-CimInstance Win32_OperatingSystem | Select "
        "TotalVisibleMemorySize,FreePhysicalMemory,TotalVirtualMemorySize,"
        "FreeVirtualMemory,SizeStoredInPagingFiles,FreeSpaceInPagingFiles | ConvertTo-Json)"
    )
    if not raw:
        return {}
    try:
        import json

        data = json.loads(raw)
        if isinstance(data, list):
            data = data[0] if data else {}
        kb = 1024
        total = int(data.get("TotalVisibleMemorySize", 0)) * kb
        free = int(data.get("FreePhysicalMemory", 0)) * kb
        page_total = int(data.get("SizeStoredInPagingFiles", 0)) * kb
        page_free = int(data.get("FreeSpaceInPagingFiles", 0)) * kb
        return {
            "workingSetBytes": max(0, total - free),
            "virtualTotalBytes": int(data.get("TotalVirtualMemorySize", 0)) * kb,
            "virtualFreeBytes": int(data.get("FreeVirtualMemory", 0)) * kb,
            "pageFileTotalBytes": page_total,
            "pageFileUsedBytes": max(0, page_total - page_free),
        }
    except Exception as exc:
        logger.debug("Memory extended parse failed: %s", exc)
        return {}


def read_kernel_pools() -> dict[str, Any]:
    if not _IS_WINDOWS:
        return {}
    raw = _powershell(
        "Get-Counter '\\Memory\\Pool Paged Bytes','\\Memory\\Pool Nonpaged Bytes' "
        "| Select -Expand CounterSamples | Select Path,CookedValue | ConvertTo-Json"
    )
    if not raw:
        return {}
    try:
        import json

        samples = json.loads(raw)
        if not isinstance(samples, list):
            samples = [samples]
        pools: dict[str, int] = {}
        for sample in samples:
            path = str(sample.get("Path", "")).lower()
            value = int(float(sample.get("CookedValue", 0)))
            if "paged" in path and "nonpaged" not in path:
                pools["pagedPoolBytes"] = value
            elif "nonpaged" in path:
                pools["nonPagedPoolBytes"] = value
        return pools
    except Exception:
        return {}


def read_battery_extended() -> dict[str, Any]:
    if not _IS_WINDOWS:
        return {}
    raw = _powershell(
        "Get-CimInstance Win32_Battery | Select EstimatedChargeRemaining, BatteryStatus, "
        "DesignCapacity, FullChargeCapacity, ExpectedLife, TimeOnBattery | ConvertTo-Json"
    )
    if not raw:
        return {}
    try:
        import json

        data = json.loads(raw)
        if isinstance(data, list):
            data = data[0] if data else {}
        design = int(data.get("DesignCapacity") or 0)
        full = int(data.get("FullChargeCapacity") or 0)
        wear = None
        if design > 0 and full > 0:
            wear = round(max(0.0, min(100.0, (1 - full / design) * 100)), 1)
        return {
            "designCapacityMwh": design or None,
            "fullChargeCapacityMwh": full or None,
            "wearPercent": wear,
            "healthPercent": round(100 - wear, 1) if wear is not None else None,
        }
    except Exception:
        return {}


def read_process_window_title(pid: int) -> str | None:
    if not _IS_WINDOWS:
        return None
    raw = _powershell(f"(Get-Process -Id {int(pid)} -ErrorAction SilentlyContinue).MainWindowTitle")
    if raw and raw.strip() and raw.strip() != "":
        return raw.strip()
    return None


def read_executable_signature(path: str) -> dict[str, Any]:
    if not _IS_WINDOWS or not path:
        return {"available": False, "status": "unavailable"}
    escaped = path.replace("'", "''")
    raw = _powershell(
        f"(Get-AuthenticodeSignature -FilePath '{escaped}' | Select Status,SignerCertificate | ConvertTo-Json)"
    )
    if not raw:
        return {"available": False, "status": "unknown"}
    try:
        import json

        data = json.loads(raw)
        status = str(data.get("Status", "Unknown"))
        signer = None
        cert = data.get("SignerCertificate")
        if isinstance(cert, dict):
            signer = cert.get("Subject")
        return {"available": True, "status": status, "signer": signer}
    except Exception:
        return {"available": False, "status": "unknown"}


def read_dns_cache(limit: int = 20) -> list[dict[str, str]]:
    if not _IS_WINDOWS:
        return []
    raw = _powershell(
        f"Get-DnsClientCache | Select Entry,Data,Status | Select-Object -First {limit} | ConvertTo-Json"
    )
    if not raw:
        return []
    try:
        import json

        rows = json.loads(raw)
        if not isinstance(rows, list):
            rows = [rows]
        return [
            {
                "entry": str(row.get("Entry", "")),
                "data": str(row.get("Data", "")),
                "status": str(row.get("Status", "")),
            }
            for row in rows
            if row.get("Entry")
        ]
    except Exception:
        return []


def list_running_drivers(limit: int = 30) -> list[str]:
    if not _IS_WINDOWS:
        return []
    raw = _powershell(
        f"Get-WmiObject Win32_SystemDriver | Where-Object {{ $_.State -eq 'Running' }} | "
        f"Select -Expand Name -First {limit}"
    )
    if not raw:
        return []
    return [line.strip() for line in raw.splitlines() if line.strip()]
