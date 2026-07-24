from __future__ import annotations

import hashlib
import time
from typing import Any, Callable, TypeVar

T = TypeVar("T")

_DOC_STATS_CACHE: dict[str, Any] = {"at_ms": 0.0, "value": None}
_EMBED_STATS_CACHE: dict[str, Any] = {"at_ms": 0.0, "value": None}
_STORAGE_CACHE: dict[str, Any] = {"at_ms": 0.0, "key": None, "value": None}
_ANALYSIS_CACHE: dict[str, Any] = {"at_ms": 0.0, "key": None, "value": None}
_DUPLICATES_CACHE: dict[str, Any] = {"at_ms": 0.0, "key": None, "value": None}
_RAG_CACHE: dict[str, dict[str, Any]] = {}
_QUERY_EMBED_CACHE: dict[str, dict[str, Any]] = {}

DOC_STATS_TTL_MS = 30_000
EMBED_STATS_TTL_MS = 30_000
STORAGE_TTL_MS = 30_000
ANALYSIS_BUNDLE_TTL_MS = 8_000
DUPLICATES_TTL_MS = 60_000
RAG_TTL_MS = 45_000
QUERY_EMBED_TTL_MS = 120_000
MAX_RAG_CACHE_ENTRIES = 32
MAX_EMBED_CACHE_ENTRIES = 64


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


def _normalize_query_key(query: str) -> str:
    return hashlib.sha256(query.strip().lower().encode("utf-8")).hexdigest()[:24]


def _trim_dict_cache(cache: dict[str, dict[str, Any]], max_entries: int) -> None:
    if len(cache) <= max_entries:
        return
    oldest_key = min(cache, key=lambda key: float(cache[key].get("at_ms", 0)))
    cache.pop(oldest_key, None)


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


def get_cached_analysis_bundle(cache_key: str, fetch: Callable[[], T]) -> T:
    cached = _read_cache(_ANALYSIS_CACHE, ANALYSIS_BUNDLE_TTL_MS)
    if cached is not None and _ANALYSIS_CACHE.get("key") == cache_key:
        return cached
    value = fetch()
    _ANALYSIS_CACHE["key"] = cache_key
    return _write_cache(_ANALYSIS_CACHE, value)


def get_cached_duplicates_context(cache_key: str, fetch: Callable[[], T]) -> T:
    cached = _read_cache(_DUPLICATES_CACHE, DUPLICATES_TTL_MS)
    if cached is not None and _DUPLICATES_CACHE.get("key") == cache_key:
        return cached
    value = fetch()
    _DUPLICATES_CACHE["key"] = cache_key
    return _write_cache(_DUPLICATES_CACHE, value)


def get_cached_rag_items(query: str, fetch: Callable[[], T]) -> T:
    key = _normalize_query_key(query)
    entry = _RAG_CACHE.get(key)
    now_ms = time.time() * 1000
    if entry is not None and now_ms - float(entry.get("at_ms", 0)) < RAG_TTL_MS:
        return entry["value"]
    value = fetch()
    _RAG_CACHE[key] = {"at_ms": now_ms, "value": value}
    _trim_dict_cache(_RAG_CACHE, MAX_RAG_CACHE_ENTRIES)
    return value


def get_cached_query_embedding(query: str, fetch: Callable[[], T]) -> T:
    key = _normalize_query_key(query)
    entry = _QUERY_EMBED_CACHE.get(key)
    now_ms = time.time() * 1000
    if entry is not None and now_ms - float(entry.get("at_ms", 0)) < QUERY_EMBED_TTL_MS:
        return entry["value"]
    value = fetch()
    _QUERY_EMBED_CACHE[key] = {"at_ms": now_ms, "value": value}
    _trim_dict_cache(_QUERY_EMBED_CACHE, MAX_EMBED_CACHE_ENTRIES)
    return value
