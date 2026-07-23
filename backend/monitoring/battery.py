from __future__ import annotations

import psutil

from backend.app.core.logging import logger


def snapshot() -> dict:
    try:
        bat = psutil.sensors_battery()
        if bat is None:
            return {
                "available": False,
                "percent": None,
                "charging": None,
                "secsLeft": None,
            }

        secs_left: int | None = None
        if bat.secsleft not in (psutil.POWER_TIME_UNKNOWN, psutil.POWER_TIME_UNLIMITED):
            secs_left = int(bat.secsleft)

        return {
            "available": True,
            "percent": round(float(bat.percent), 2) if bat.percent is not None else None,
            "charging": bool(bat.power_plugged),
            "secsLeft": secs_left,
        }
    except Exception as exc:
        logger.debug("Battery metrics failed: %s", exc)
        return {
            "available": False,
            "percent": None,
            "charging": None,
            "secsLeft": None,
        }
