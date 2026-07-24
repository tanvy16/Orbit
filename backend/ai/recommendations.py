from __future__ import annotations


def build_recommendations(bundle: dict, indexing: dict, duplicates_note: str) -> list[dict]:
    """Prioritized recommendations from real telemetry and index state."""
    items: list[dict] = []
    health = bundle.get("health", {})
    perf = bundle.get("performance", {})
    mem = bundle.get("memory", {})
    disk = bundle.get("telemetry", {}).get("disk", {})
    bat = bundle.get("telemetry", {}).get("battery", {})

    if perf.get("pressure") == "high":
        items.append(
            {
                "severity": "high",
                "title": "High CPU load",
                "detail": perf.get("summary", ""),
                "action": "Close CPU-heavy apps or pause intensive tasks",
            }
        )
    if mem.get("pressure") in ("high", "critical"):
        items.append(
            {
                "severity": "high",
                "title": "Memory pressure",
                "detail": mem.get("summary", ""),
                "action": "Restart or close top memory consumers",
            }
        )
    if float(disk.get("usagePercent", 0)) >= 85:
        items.append(
            {
                "severity": "medium",
                "title": "Low disk space",
                "detail": f"Disk {disk.get('usagePercent')}% full",
                "action": "Remove large files or clear temporary data",
            }
        )
    if bat.get("available") and bat.get("percent") is not None and bat["percent"] < 20 and not bat.get("charging"):
        items.append(
            {
                "severity": "medium",
                "title": "Low battery",
                "detail": f"Battery at {bat['percent']}%",
                "action": "Connect power or reduce background workload",
            }
        )
    pending = int(indexing.get("documentsPending", 0) or 0)
    failed = int(indexing.get("documentsFailed", 0) or 0)
    if pending > 50:
        items.append(
            {
                "severity": "low",
                "title": "Embedding backlog",
                "detail": f"{pending} documents waiting for embeddings",
                "action": "Wait for background embedding or check Settings",
            }
        )
    if failed > 0:
        items.append(
            {
                "severity": "medium",
                "title": "Embedding failures",
                "detail": f"{failed} documents failed to embed",
                "action": "Review failed files in dashboard and re-sync embeddings",
            }
        )
    if "duplicate" in duplicates_note.lower() and "no duplicate" not in duplicates_note.lower():
        items.append(
            {
                "severity": "low",
                "title": "Duplicate files detected",
                "detail": "Exact or near-duplicate files found in index",
                "action": "Review duplicates to reclaim storage",
            }
        )

    for rec in health.get("recommendations") or []:
        if rec not in [i["action"] for i in items]:
            items.append(
                {
                    "severity": "low",
                    "title": "System health",
                    "detail": rec,
                    "action": rec,
                }
            )

    order = {"high": 0, "medium": 1, "low": 2}
    items.sort(key=lambda x: order.get(str(x.get("severity")), 9))
    return items[:8]
