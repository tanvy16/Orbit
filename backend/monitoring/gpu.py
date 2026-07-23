from __future__ import annotations

import shutil
import subprocess

from backend.app.core.logging import logger


def snapshot() -> dict:
    if shutil.which("nvidia-smi"):
        try:
            result = subprocess.run(
                [
                    "nvidia-smi",
                    "--query-gpu=utilization.gpu,name,memory.used,memory.total",
                    "--format=csv,noheader,nounits",
                ],
                capture_output=True,
                text=True,
                timeout=2,
                check=False,
            )
            if result.returncode == 0 and result.stdout.strip():
                line = result.stdout.strip().splitlines()[0]
                parts = [p.strip() for p in line.split(",")]
                if len(parts) >= 4:
                    util = float(parts[0])
                    name = parts[1]
                    mem_used = float(parts[2])
                    mem_total = float(parts[3])
                    return {
                        "available": True,
                        "usagePercent": round(util, 2),
                        "name": name,
                        "memoryUsedMb": mem_used,
                        "memoryTotalMb": mem_total,
                    }
        except Exception as exc:
            logger.debug("GPU nvidia-smi failed: %s", exc)

    return {
        "available": False,
        "usagePercent": None,
        "name": None,
        "memoryUsedMb": None,
        "memoryTotalMb": None,
    }
