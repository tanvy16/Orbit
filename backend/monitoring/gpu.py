from __future__ import annotations

import platform
import shutil
import subprocess

from backend.app.core.logging import logger


def snapshot() -> dict:
    unavailable_reason = None
    if platform.system() == "Windows" and not shutil.which("nvidia-smi"):
        unavailable_reason = (
            "NVIDIA GPU metrics require nvidia-smi. AMD/Intel GPUs are not yet exposed via this collector."
        )
    elif platform.system() != "Windows" and not shutil.which("nvidia-smi"):
        unavailable_reason = "GPU telemetry requires nvidia-smi on this platform."

    if shutil.which("nvidia-smi"):
        try:
            result = subprocess.run(
                [
                    "nvidia-smi",
                    "--query-gpu=utilization.gpu,utilization.memory,name,memory.used,memory.total,"
                    "temperature.gpu,clocks.current.graphics,power.draw",
                    "--format=csv,noheader,nounits",
                ],
                capture_output=True,
                text=True,
                timeout=3,
                check=False,
            )
            if result.returncode == 0 and result.stdout.strip():
                line = result.stdout.strip().splitlines()[0]
                parts = [p.strip() for p in line.split(",")]
                if len(parts) >= 8:
                    return {
                        "available": True,
                        "usagePercent": round(float(parts[0]), 2),
                        "memoryUsagePercent": round(float(parts[1]), 2),
                        "name": parts[2],
                        "memoryUsedMb": float(parts[3]),
                        "memoryTotalMb": float(parts[4]),
                        "temperatureCelsius": float(parts[5]) if parts[5] not in ("[N/A]", "") else None,
                        "clockMhz": float(parts[6]) if parts[6] not in ("[N/A]", "") else None,
                        "powerWatts": float(parts[7]) if parts[7] not in ("[N/A]", "") else None,
                        "unavailableReason": None,
                    }
        except Exception as exc:
            logger.debug("GPU nvidia-smi failed: %s", exc)
            unavailable_reason = f"nvidia-smi query failed: {exc}"

    return {
        "available": False,
        "usagePercent": None,
        "memoryUsagePercent": None,
        "name": None,
        "memoryUsedMb": None,
        "memoryTotalMb": None,
        "temperatureCelsius": None,
        "clockMhz": None,
        "powerWatts": None,
        "unavailableReason": unavailable_reason or "GPU metrics unavailable on this system.",
    }
