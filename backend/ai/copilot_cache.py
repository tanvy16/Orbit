from __future__ import annotations

import time
from typing import Any, Callable, TypeVar

T = TypeVar("T")

_DOC_STATS_CACHE: dict[str, Any] = {"at_ms": 0.0, "value": None}
_EMBED_STATS_CACHE: dict[str, Any] = {"at_ms": 0.0, "value": None}
_STORAGE_CACHE: dict[str, Any] = {"at_ms": 0.0, "key": None, "value": None}

DOC_STATS_TTL_MS = 30_000
EMBED_STATS_TTL_MS = 30_000
STORAGE_TTL_MS = 30_000


def _read_cache(entry: dict, ttl_ms: float) -> Any | None:
    value = entry.get("value")
    if value is None:
        return None
    age = time.time() * 1000 - float(entry.get("at_ms", 0))
    if age >= ttl_ms:
        return None
    return value


def _write_cache(entry: dict, value: Any) -> Any:
    entry["at_ms"] = time.time() * 1000
    entry["value"] = value
    return value


def get_cached_doc_stats(fetch: Callable[[], T]) -> T:
    cached = _read_cache(_DOC_STATS_CACHE, DOC_STATS_TTL_MS)
    if cached is not None:
        return cached
    return _write_cache(_DOC_STATS_CACHE, fetch())


def get_cached_embed_stats(fetch: Callable[[], T]) -> T:
    cached = _read_cache(_EMBED_STATS_CACHE, EMBED_STATS_TTL_MS)
    if cached is not None:
        return cached
    return _write_cache(_EMBED_STATS_CACHE, fetch())


def get_cached_storage_context(cache_key: str, fetch: Callable[[], T]) -> T:
    cached = _read_cache(_STORAGE_CACHE, STORAGE_TTL_MS)
    if cached is not None and _STORAGE_CACHE.get("key") == cache_key:
        return cached
    value = fetch()
    _STORAGE_CACHE["key"] = cache_key
    return _write_cache(_STORAGE_CACHE, value)
