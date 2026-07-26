from __future__ import annotations

import os
import tempfile
import time
from pathlib import Path

import psutil

from backend.ai.storage_intel import read_smart_summary
from backend.app.core.logging import logger
from backend.monitoring import disk as disk_monitor


def _dir_size(path: Path, max_depth: int = 2, limit: int = 15) -> list[dict]:
    results: list[tuple[int, str]] = []
    if not path.exists():
        return []

    try:
        for entry in path.iterdir():
            if entry.is_dir():
                total = 0
                try:
                    for root, _, files in os.walk(entry):
                        depth = root[len(str(entry)) :].count(os.sep)
                        if depth > max_depth:
                            break
                        for fname in files:
                            try:
                                total += os.path.getsize(os.path.join(root, fname))
                            except OSError:
                                pass
                except OSError:
                    pass
                if total > 0:
                    results.append((total, str(entry)))
    except OSError as exc:
        logger.debug("Storage scan skipped for %s: %s", path, exc)

    results.sort(reverse=True)
    return [{"path": p, "sizeBytes": s} for s, p in results[:limit]]


def _largest_files(root: Path, limit: int = 12, max_files_scanned: int = 8000) -> list[dict]:
    candidates: list[tuple[int, str]] = []
    scanned = 0
    try:
        for dirpath, _, files in os.walk(root):
            for fname in files:
                scanned += 1
                if scanned > max_files_scanned:
                    break
                fpath = os.path.join(dirpath, fname)
                try:
                    size = os.path.getsize(fpath)
                    if size >= 50 * 1024 * 1024:
                        candidates.append((size, fpath))
                except OSError:
                    pass
            if scanned > max_files_scanned:
                break
    except OSError:
        return []
    candidates.sort(reverse=True)
    return [{"path": p, "sizeBytes": s} for s, p in candidates[:limit]]


def collect() -> dict:
    base = disk_monitor.snapshot()
    home = Path.home()
    temp_dirs = [
        Path(tempfile.gettempdir()),
        home / "Downloads",
        home / "AppData" / "Local" / "Temp" if os.name == "nt" else home / ".cache",
    ]

    large_folders: list[dict] = []
    temp_estimate = 0
    for directory in temp_dirs:
        if directory.exists():
            scan_root = directory.parent if directory.name == "Temp" else directory
            folders = _dir_size(scan_root, max_depth=1, limit=8)
            large_folders.extend(folders)
            for item in folders:
                if "temp" in item["path"].lower() or "cache" in item["path"].lower():
                    temp_estimate += item["sizeBytes"]

    large_folders.sort(key=lambda x: x["sizeBytes"], reverse=True)
    large_folders = large_folders[:12]
    largest_files = _largest_files(home / "Downloads") if (home / "Downloads").exists() else []

    smart_raw = read_smart_summary()
    smart_status = "unavailable"
    if smart_raw:
        smart_status = "healthy" if "healthy" in smart_raw.lower() or "ok" in smart_raw.lower() else "see_report"

    usage_pct = float(base.get("usagePercent", 0))
    free_bytes = int(base.get("freeBytes", 0))
    reclaimable_gb = temp_estimate / (1024**3)

    recommendations: list[str] = []
    if usage_pct >= 85:
        recommendations.append(
            f"Primary drive is {usage_pct:.0f}% full — only {free_bytes // (1024**3)} GB free."
        )
    if reclaimable_gb >= 0.5:
        recommendations.append(
            f"Approximately {reclaimable_gb:.1f} GB may be reclaimable from temporary and cache folders (sampled estimate)."
        )
    if largest_files:
        top = largest_files[0]
        recommendations.append(
            f"Largest sampled file: {Path(top['path']).name} ({top['sizeBytes'] // (1024**3)} GB) in Downloads."
        )
    if not recommendations:
        recommendations.append("Storage usage is within normal limits based on collected metrics.")

    return {
        **base,
        "largestFolders": large_folders,
        "largestFiles": largest_files,
        "tempEstimateBytes": temp_estimate,
        "smartStatus": smart_status,
        "smartReport": smart_raw,
        "healthScore": max(0, min(100, int(100 - usage_pct * 0.8))),
        "recommendations": recommendations,
        "aiSummary": recommendations[0] if recommendations else "Storage metrics collected.",
    }
