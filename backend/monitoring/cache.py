from __future__ import annotations

import time

from backend.monitoring.aggregator import collect_light_snapshot, collect_snapshot

_FULL_CACHE: dict = {"at_ms": 0.0, "snapshot": None}
_LIGHT_CACHE: dict = {"at_ms": 0.0, "snapshot": None}
_METRICS_LAST_WRITE_MS = 0.0

FULL_TTL_MS = 5000
LIGHT_TTL_MS = 5000
PROCESS_TTL_MS = 5000
METRICS_WRITE_INTERVAL_MS = 30_000


def _maybe_persist_metrics(snapshot: dict) -> None:
    global _METRICS_LAST_WRITE_MS
    now = time.time() * 1000
    if now - _METRICS_LAST_WRITE_MS < METRICS_WRITE_INTERVAL_MS:
        return
    _METRICS_LAST_WRITE_MS = now
    try:
        from backend.app.database.session import SessionLocal
        from backend.observability.metrics_service import HistoricalMetricsService

        db = SessionLocal()
        try:
            HistoricalMetricsService(db).record_snapshot(snapshot)
            HistoricalMetricsService(db).prune_older_than_hours(48)
        finally:
            db.close()
    except Exception:
        pass


def get_cached_snapshot(*, force: bool = False, include_processes: bool = True) -> dict:
    """
    Return a cached telemetry snapshot.

    - Full snapshot (with processes): refreshed at most every 5s.
    - Light snapshot (no process scan): refreshed at most every 3s.
    """
    now = time.time() * 1000

    if include_processes:
        cached = _FULL_CACHE.get("snapshot")
        age = now - float(_FULL_CACHE.get("at_ms", 0))
        if not force and cached is not None and age < PROCESS_TTL_MS:
            return cached
        snapshot = collect_snapshot()
        _FULL_CACHE["at_ms"] = now
        _FULL_CACHE["snapshot"] = snapshot
        _LIGHT_CACHE["at_ms"] = now
        _LIGHT_CACHE["snapshot"] = _light_from_full(snapshot)
        try:
            from backend.intelligence.timeline import observe_snapshot

            observe_snapshot(snapshot)
        except Exception:
            pass
        _maybe_persist_metrics(snapshot)
        return snapshot

    cached_light = _LIGHT_CACHE.get("snapshot")
    age_light = now - float(_LIGHT_CACHE.get("at_ms", 0))
    if not force and cached_light is not None and age_light < LIGHT_TTL_MS:
        return cached_light

    full_cached = _FULL_CACHE.get("snapshot")
    full_age = now - float(_FULL_CACHE.get("at_ms", 0))
    if not force and full_cached is not None and full_age < PROCESS_TTL_MS:
        light = _light_from_full(full_cached)
        _LIGHT_CACHE["at_ms"] = now
        _LIGHT_CACHE["snapshot"] = light
        return light

    snapshot = collect_light_snapshot()
    _LIGHT_CACHE["at_ms"] = now
    _LIGHT_CACHE["snapshot"] = snapshot
    return snapshot


def _light_from_full(snapshot: dict) -> dict:
    return {
        **snapshot,
        "processes": {"count": snapshot.get("processes", {}).get("count", 0), "items": []},
    }
