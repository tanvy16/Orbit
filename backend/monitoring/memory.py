from __future__ import annotations

import psutil

from backend.app.core.logging import logger


def snapshot(process_items: list[dict] | None = None) -> dict:
    try:
        vm = psutil.virtual_memory()
        if process_items is not None:
            top = [
                {"pid": p["pid"], "name": p["name"], "memoryBytes": p["memoryBytes"]}
                for p in process_items[:8]
            ]
        else:
            top = []
        return {
            "totalBytes": int(vm.total),
            "usedBytes": int(vm.used),
            "availableBytes": int(vm.available),
            "usagePercent": round(float(vm.percent), 2),
            "topProcesses": top,
        }
    except Exception as exc:
        logger.debug("Memory metrics failed: %s", exc)
        return {
            "totalBytes": 0,
            "usedBytes": 0,
            "availableBytes": 0,
            "usagePercent": 0.0,
            "topProcesses": [],
        }
