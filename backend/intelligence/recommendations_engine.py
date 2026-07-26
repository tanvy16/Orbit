from __future__ import annotations

from typing import Any

from backend.app.database.session import SessionLocal
from backend.observability.metrics_service import HistoricalMetricsService


def _query_series(metric: str, hours: float) -> list[float]:
    db = SessionLocal()
    try:
        points = HistoricalMetricsService(db).query(metric, hours=hours)
    finally:
        db.close()
    return [float(p["value"]) for p in points if p.get("value") is not None]


def build_trend_recommendations(snapshot: dict[str, Any]) -> list[dict[str, str]]:
    """Evidence-based recommendations using historical telemetry."""
    items: list[dict[str, str]] = []

    ram_series = _query_series("ram", hours=0.5)
    if len(ram_series) >= 4:
        start_slice = ram_series[: max(2, len(ram_series) // 4)]
        start_avg = sum(start_slice) / max(1, len(start_slice))
        end_slice = ram_series[-3:]
        end_avg = sum(end_slice) / max(1, len(end_slice))
        delta = end_avg - start_avg
        if delta >= 8:
            items.append(
                {
                    "severity": "high",
                    "title": "Sustained memory increase",
                    "detail": f"RAM usage rose ~{delta:.0f}% over the last 30 minutes (from ~{start_avg:.0f}% to ~{end_avg:.0f}%).",
                    "action": "Review top memory consumers and close unused applications.",
                }
            )

    cpu_series = _query_series("cpu", hours=0.5)
    if len(cpu_series) >= 4:
        recent_peak = max(cpu_series[-6:])
        recent_avg = sum(cpu_series[-6:]) / min(6, len(cpu_series[-6:]))
        if recent_peak >= 75 and recent_avg >= 55:
            top_cpu = snapshot.get("processes", {}).get("items") or []
            leader = top_cpu[0] if top_cpu else None
            detail = f"CPU averaged {recent_avg:.0f}% with peaks to {recent_peak:.0f}% in the last 30 minutes."
            if leader:
                detail += f" {leader.get('name')} is the heaviest sampled consumer ({leader.get('cpuPercent')}%)."
            items.append(
                {
                    "severity": "medium",
                    "title": "Recent CPU spikes",
                    "detail": detail,
                    "action": "Wait for background tasks to finish or close CPU-heavy apps.",
                }
            )

    mem = snapshot.get("memory", {})
    top = mem.get("topProcesses") or []
    if top:
        leader = top[0]
        mem_mb = int(leader.get("memoryBytes", 0)) // (1024 * 1024)
        if mem_mb >= 2048:
            items.append(
                {
                    "severity": "medium",
                    "title": f"{leader.get('name')} using significant RAM",
                    "detail": f"{leader.get('name')} currently holds ~{mem_mb / 1024:.1f} GB RSS in the latest snapshot.",
                    "action": f"Inspect or restart {leader.get('name')} if memory stays elevated.",
                }
            )

    disk_pct = float(snapshot.get("disk", {}).get("usagePercent", 0))
    if disk_pct >= 88:
        free_gb = int(snapshot.get("disk", {}).get("freeBytes", 0)) // (1024**3)
        items.append(
            {
                "severity": "high",
                "title": "Storage nearly full",
                "detail": f"Primary drive is {disk_pct:.0f}% full with ~{free_gb} GB free.",
                "action": "Open Storage Intelligence for cleanup opportunities.",
            }
        )

    return items[:6]
