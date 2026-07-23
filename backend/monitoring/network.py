from __future__ import annotations

import time

import psutil

from backend.app.core.logging import logger

_prev_counters = None
_prev_time: float | None = None


def snapshot() -> dict:
    global _prev_counters, _prev_time

    upload_bps = 0.0
    download_bps = 0.0

    try:
        counters = psutil.net_io_counters()
        now = time.monotonic()

        if _prev_counters is not None and _prev_time is not None:
            dt = max(now - _prev_time, 0.001)
            upload_bps = max(0.0, (counters.bytes_sent - _prev_counters.bytes_sent) / dt)
            download_bps = max(0.0, (counters.bytes_recv - _prev_counters.bytes_recv) / dt)

        _prev_counters = counters
        _prev_time = now

        return {
            "uploadBytesPerSec": round(upload_bps, 2),
            "downloadBytesPerSec": round(download_bps, 2),
            "bytesSentTotal": int(counters.bytes_sent),
            "bytesRecvTotal": int(counters.bytes_recv),
        }
    except Exception as exc:
        logger.debug("Network metrics failed: %s", exc)
        return {
            "uploadBytesPerSec": 0.0,
            "downloadBytesPerSec": 0.0,
            "bytesSentTotal": 0,
            "bytesRecvTotal": 0,
        }
