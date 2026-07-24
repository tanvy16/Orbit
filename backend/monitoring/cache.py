from __future__ import annotations

import time

from backend.monitoring.aggregator import collect_light_snapshot, collect_snapshot

_FULL_CACHE: dict = {"at_ms": 0.0, "snapshot": None}
_LIGHT_CACHE: dict = {"at_ms": 0.0, "snapshot": None}

FULL_TTL_MS = 2500
LIGHT_TTL_MS = 2500
PROCESS_TTL_MS = 2500


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
