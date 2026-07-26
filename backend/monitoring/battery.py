from __future__ import annotations

import platform
import shutil
import subprocess

import psutil

from backend.app.core.logging import logger
from backend.intelligence.platform_win import read_battery_extended


def snapshot() -> dict:
    base = {
        "available": False,
        "percent": None,
        "charging": None,
        "secsLeft": None,
        "designCapacityMwh": None,
        "fullChargeCapacityMwh": None,
        "wearPercent": None,
        "healthPercent": None,
        "unavailableReason": None,
    }
    try:
        bat = psutil.sensors_battery()
        if bat is None:
            base["unavailableReason"] = "No battery detected — desktop power or unsupported hardware."
            return base

        secs_left: int | None = None
        if bat.secsleft not in (psutil.POWER_TIME_UNKNOWN, psutil.POWER_TIME_UNLIMITED):
            secs_left = int(bat.secsleft)

        extended = read_battery_extended()
        return {
            "available": True,
            "percent": round(float(bat.percent), 2) if bat.percent is not None else None,
            "charging": bool(bat.power_plugged),
            "secsLeft": secs_left,
            "designCapacityMwh": extended.get("designCapacityMwh"),
            "fullChargeCapacityMwh": extended.get("fullChargeCapacityMwh"),
            "wearPercent": extended.get("wearPercent"),
            "healthPercent": extended.get("healthPercent"),
            "unavailableReason": None,
        }
    except Exception as exc:
        logger.debug("Battery metrics failed: %s", exc)
        base["unavailableReason"] = f"Battery telemetry unavailable: {exc}"
        return base
