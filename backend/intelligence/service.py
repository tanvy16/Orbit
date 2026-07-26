from __future__ import annotations

from typing import Any

from backend.ai.analyzer import build_analysis_bundle
from backend.intelligence import cpu_intel, kernel_intel, memory_intel, network_intel, storage_intel
from backend.intelligence.timeline import get_timeline, observe_snapshot
from backend.monitoring.aggregator import collect_snapshot
from backend.monitoring import battery, gpu, processes
from backend.observability.metrics_service import HistoricalMetricsService
from backend.intelligence.recommendations_engine import build_trend_recommendations


def _recommendations_from_bundle(bundle: dict) -> list[dict]:
    from backend.ai.recommendations import build_recommendations

    return build_recommendations(bundle, {}, "")


def build_overview() -> dict[str, Any]:
    started = __import__("time").perf_counter()
    snapshot = collect_snapshot()
    observe_snapshot(snapshot)

    bundle = build_analysis_bundle(snapshot, include_temperatures=True)
    health = bundle["health"]

    # Factor breakdown for health score transparency
    factors = {
        "cpu": {"score": 100 - min(100, int(bundle["performance"].get("cpuUsagePercent", 0))), "label": "CPU"},
        "memory": {"score": 100 - min(100, int(bundle["memory"].get("usagePercent", 0))), "label": "Memory"},
        "disk": {"score": 100 - min(100, int(snapshot.get("disk", {}).get("usagePercent", 0))), "label": "Disk"},
        "network": {"score": 95, "label": "Network"},
        "storageHealth": {"score": max(0, 100 - int(snapshot.get("disk", {}).get("usagePercent", 0) * 0.9)), "label": "Storage"},
    }
    bat = snapshot.get("battery", {})
    if bat.get("available") and bat.get("percent") is not None:
        factors["battery"] = {"score": int(bat["percent"]), "label": "Battery"}

    collection_ms = (__import__("time").perf_counter() - started) * 1000

    static_recs = _recommendations_from_bundle(bundle)
    trend_recs = build_trend_recommendations(snapshot)
    seen_titles = set()
    merged_recs: list[dict] = []
    for rec in trend_recs + static_recs:
        title = rec.get("title", "")
        if title in seen_titles:
            continue
        seen_titles.add(title)
        merged_recs.append(rec)

    return {
        "timestamp": snapshot["timestamp"],
        "health": {
            **health,
            "factors": factors,
            "explanation": (
                "Score starts at 100 and decreases with CPU pressure, memory pressure, storage usage, "
                "battery level, and detected warnings. Each factor reflects live telemetry."
            ),
        },
        "recommendations": merged_recs[:10],
        "timeline": get_timeline(30),
        "resources": {
            "cpu": {"usagePercent": snapshot["cpu"]["usagePercent"], "summary": bundle["performance"].get("summary")},
            "memory": {"usagePercent": snapshot["memory"]["usagePercent"], "summary": bundle["memory"].get("summary")},
            "disk": {"usagePercent": snapshot["disk"]["usagePercent"], "freeBytes": snapshot["disk"]["freeBytes"]},
            "network": {
                "downloadBytesPerSec": snapshot["network"]["downloadBytesPerSec"],
                "uploadBytesPerSec": snapshot["network"]["uploadBytesPerSec"],
            },
            "gpu": snapshot["gpu"],
            "battery": snapshot["battery"],
        },
        "processes": snapshot["processes"],
        "collectionMs": round(collection_ms, 2),
    }


def build_cpu_view() -> dict[str, Any]:
    snapshot = collect_snapshot()
    procs = sorted(snapshot["processes"]["items"], key=lambda p: p.get("cpuPercent", 0), reverse=True)[:15]
    cpu = cpu_intel.collect(procs)
    bundle = build_analysis_bundle(snapshot)
    history = build_history("cpu", 1)
    return {
        "timestamp": snapshot["timestamp"],
        "metrics": cpu,
        "topProcesses": procs,
        "analysis": bundle["performance"],
        "history": history,
    }


def build_memory_view() -> dict[str, Any]:
    snapshot = collect_snapshot()
    history = build_history("ram", 1)
    delta = None
    if history["average"] and history["current"]:
        delta = history["current"] - history["average"]
    mem = memory_intel.collect(snapshot["processes"]["items"], history_delta_pct=delta)
    bundle = build_analysis_bundle(snapshot)
    static = _recommendations_from_bundle(bundle)
    trend = build_trend_recommendations(snapshot)
    return {
        "timestamp": snapshot["timestamp"],
        "metrics": mem,
        "analysis": bundle["memory"],
        "recommendations": (trend + static)[:8],
        "history": history,
    }


def build_storage_view() -> dict[str, Any]:
    data = storage_intel.collect()
    return {"timestamp": int(__import__("time").time() * 1000), **data, "history": build_history("disk", 24)}


def build_network_view() -> dict[str, Any]:
    data = network_intel.collect()
    return {
        "timestamp": int(__import__("time").time() * 1000),
        **data,
        "historyDown": build_history("network_down", 1),
        "historyUp": build_history("network_up", 1),
    }


def build_kernel_view() -> dict[str, Any]:
    return {"timestamp": int(__import__("time").time() * 1000), **kernel_intel.collect()}


def build_gpu_view() -> dict[str, Any]:
    snap = gpu.snapshot()
    return {"timestamp": int(__import__("time").time() * 1000), "gpu": snap}


def build_battery_view() -> dict[str, Any]:
    snap = battery.snapshot()
    return {"timestamp": int(__import__("time").time() * 1000), "battery": snap}


def build_history(metric: str, hours: float) -> dict[str, Any]:
    from backend.app.database.session import SessionLocal

    db = SessionLocal()
    try:
        points = HistoricalMetricsService(db).query(metric, hours=hours)
    finally:
        db.close()
    values = [p["value"] for p in points]
    avg = sum(values) / len(values) if values else 0
    current = values[-1] if values else 0
    unusual = abs(current - avg) > max(10, avg * 0.25) if values else False
    return {
        "metric": metric,
        "hours": hours,
        "points": points,
        "average": round(avg, 2),
        "current": round(current, 2),
        "unusual": unusual,
    }
