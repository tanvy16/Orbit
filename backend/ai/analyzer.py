from __future__ import annotations

import psutil

from backend.app.core.logging import logger


def _format_bytes(num: int) -> str:
    if num < 1024**2:
        return f"{num / 1024:.1f} KB"
    if num < 1024**3:
        return f"{num / 1024**2:.1f} MB"
    return f"{num / 1024**3:.2f} GB"


def read_temperatures() -> list[dict]:
    readings: list[dict] = []
    try:
        sensors = psutil.sensors_temperatures()
        for name, entries in sensors.items():
            for entry in entries[:3]:
                if entry.current is not None:
                    readings.append(
                        {
                            "sensor": name,
                            "label": entry.label or name,
                            "celsius": round(float(entry.current), 1),
                        }
                    )
    except (AttributeError, Exception) as exc:
        logger.debug("Temperature sensors unavailable: %s", exc)
    return readings[:8]


def analyze_performance(telemetry: dict) -> dict:
    cpu = telemetry.get("cpu", {})
    usage = float(cpu.get("usagePercent", 0))
    history = cpu.get("loadHistory") or []
    avg_hist = sum(history) / len(history) if history else usage

    pressure = "low"
    if usage >= 85 or avg_hist >= 75:
        pressure = "high"
    elif usage >= 60 or avg_hist >= 50:
        pressure = "moderate"

    issues: list[str] = []
    if pressure == "high":
        issues.append(f"CPU usage elevated at {usage:.0f}%")
    if pressure == "moderate":
        issues.append(f"Sustained CPU activity around {avg_hist:.0f}%")

    return {
        "cpuUsagePercent": usage,
        "cpuAverageHistory": round(avg_hist, 1),
        "pressure": pressure,
        "issues": issues,
        "summary": f"CPU at {usage:.0f}% ({pressure} pressure).",
    }


def analyze_memory(telemetry: dict) -> dict:
    mem = telemetry.get("memory", {})
    pct = float(mem.get("usagePercent", 0))
    used = int(mem.get("usedBytes", 0))
    total = int(mem.get("totalBytes", 0))
    top = mem.get("topProcesses") or []

    pressure = "low"
    if pct >= 90:
        pressure = "critical"
    elif pct >= 75:
        pressure = "high"
    elif pct >= 60:
        pressure = "moderate"

    top_lines = [
        f"{p.get('name', 'unknown')} — {_format_bytes(int(p.get('memoryBytes', 0)))}" for p in top[:5]
    ]

    issues: list[str] = []
    if pressure in ("high", "critical"):
        issues.append(f"Memory usage at {pct:.0f}% ({_format_bytes(used)} / {_format_bytes(total)})")

    return {
        "usagePercent": pct,
        "usedBytes": used,
        "totalBytes": total,
        "pressure": pressure,
        "topConsumers": top_lines,
        "issues": issues,
        "summary": f"RAM {pct:.0f}% used; top: {top_lines[0] if top_lines else 'n/a'}.",
    }


def analyze_processes(telemetry: dict) -> dict:
    procs = telemetry.get("processes", {})
    items = procs.get("items") or []
    count = int(procs.get("count", len(items)))

    heavy_cpu = [p for p in items if float(p.get("cpuPercent", 0)) >= 15][:5]
    heavy_mem = sorted(items, key=lambda p: int(p.get("memoryBytes", 0)), reverse=True)[:5]

    cpu_lines = [
        f"{p.get('name')} — CPU {p.get('cpuPercent')}%"
        for p in heavy_cpu
    ] or ["No single process above 15% CPU in sampled set."]

    mem_lines = [
        f"{p.get('name')} — {_format_bytes(int(p.get('memoryBytes', 0)))}"
        for p in heavy_mem
    ]

    return {
        "processCount": count,
        "heavyCpu": cpu_lines,
        "heavyMemory": mem_lines,
        "summary": f"{count} processes running; heaviest CPU: {cpu_lines[0]}.",
    }


def generate_health_summary(telemetry: dict) -> dict:
    perf = analyze_performance(telemetry)
    mem = analyze_memory(telemetry)
    disk = telemetry.get("disk", {})
    disk_pct = float(disk.get("usagePercent", 0))
    bat = telemetry.get("battery", {})
    gpu = telemetry.get("gpu", {})

    score = 100
    issues: list[str] = []
    recommendations: list[str] = []

    if perf["pressure"] == "high":
        score -= 25
        issues.append("High CPU load")
        recommendations.append("Close CPU-heavy applications or defer intensive tasks")
    elif perf["pressure"] == "moderate":
        score -= 10

    if mem["pressure"] == "critical":
        score -= 30
        issues.append("Critical memory pressure")
        recommendations.append("Close unused applications to free RAM")
    elif mem["pressure"] == "high":
        score -= 20
        issues.append("High memory usage")
        recommendations.append("Review top memory consumers and restart heavy apps if needed")
    elif mem["pressure"] == "moderate":
        score -= 8

    if disk_pct >= 92:
        score -= 20
        issues.append("Storage nearly full")
        recommendations.append("Free disk space or move large files off the system drive")
    elif disk_pct >= 85:
        score -= 10
        issues.append("Low storage headroom")

    if bat.get("available") and bat.get("percent") is not None and bat["percent"] < 20 and not bat.get("charging"):
        score -= 10
        issues.append("Low battery")
        recommendations.append("Connect power or reduce background workload")

    if gpu.get("available") and gpu.get("usagePercent") is not None and gpu["usagePercent"] > 90:
        score -= 8
        issues.append("GPU heavily utilized")

    score = max(0, min(100, score))
    if score >= 80:
        performance_label = "Good"
    elif score >= 55:
        performance_label = "Fair"
    else:
        performance_label = "Poor"

    if not recommendations:
        recommendations.append("System metrics look healthy — no urgent action needed")

    return {
        "score": score,
        "performance": performance_label,
        "detectedIssues": issues or ["No critical issues detected"],
        "recommendations": recommendations,
    }


def build_analysis_bundle(telemetry: dict) -> dict:
    temps = read_temperatures()
    enriched = {**telemetry, "temperatures": temps}
    return {
        "telemetry": enriched,
        "performance": analyze_performance(enriched),
        "memory": analyze_memory(enriched),
        "processes": analyze_processes(enriched),
        "health": generate_health_summary(enriched),
    }
