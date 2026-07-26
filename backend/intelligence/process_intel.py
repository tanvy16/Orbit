from __future__ import annotations

import time

import psutil

from backend.app.core.logging import logger
from backend.intelligence.platform_win import read_executable_signature, read_process_window_title
from backend.intelligence.timeline import get_process_memory_trend


def _safe_proc(pid: int) -> psutil.Process | None:
    try:
        return psutil.Process(pid)
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        return None


def _classify_process(
    proc: psutil.Process,
    cpu_pct: float,
    mem_bytes: int,
    trend: list[dict],
    conn_count: int,
    io_read: int | None,
    io_write: int | None,
) -> list[dict]:
    labels: list[dict] = []
    try:
        status = proc.status()
    except Exception:
        status = "unknown"

    if status == psutil.STATUS_ZOMBIE:
        labels.append({"label": "Unknown", "evidence": "Process is in zombie state"})
        return labels

    if cpu_pct >= 50:
        labels.append({"label": "Busy", "evidence": f"CPU usage at {cpu_pct:.1f}%"})
    elif cpu_pct <= 1 and mem_bytes < 50 * 1024 * 1024:
        labels.append({"label": "Idle", "evidence": f"Low CPU ({cpu_pct:.1f}%) and modest memory footprint"})

    if mem_bytes >= 1024**3:
        labels.append({"label": "High Memory Usage", "evidence": f"RSS exceeds 1 GB ({mem_bytes // (1024**2)} MB)"})

    if len(trend) >= 4:
        first = trend[0]["memoryBytes"]
        last = trend[-1]["memoryBytes"]
        if first > 0 and last > first * 1.35:
            labels.append({"label": "Growing", "evidence": f"Memory grew from {first // (1024**2)} MB to {last // (1024**2)} MB"})
            if last > first * 1.6:
                labels.append({"label": "Possible Memory Leak", "evidence": f"Sustained growth of {((last - first) / first * 100):.0f}%"})

    if (io_read or 0) + (io_write or 0) > 500 * 1024 * 1024:
        labels.append({"label": "High Disk Activity", "evidence": f"Disk I/O read {((io_read or 0) // (1024**2))} MB, write {((io_write or 0) // (1024**2))} MB"})

    if conn_count >= 10:
        labels.append({"label": "High Network Activity", "evidence": f"{conn_count} active network connections observed"})

    try:
        if status in (getattr(psutil, "STATUS_STOPPED", None),):
            labels.append({"label": "Unresponsive", "evidence": f"Process status: {status}"})
    except Exception:
        pass

    if not labels:
        labels.append({"label": "Healthy", "evidence": "Resource usage within normal observed limits"})
    return labels


def _build_summary(name: str, cpu_pct: float, mem_bytes: int, thread_count: int, conn_count: int, classifications: list[dict]) -> str:
    mem_mb = mem_bytes // (1024 * 1024)
    parts = [f"{name} is using {cpu_pct:.1f}% CPU, {mem_mb} MB RAM, and {thread_count} threads."]
    if conn_count >= 5:
        parts.append(f"The process maintains {conn_count} active network connections.")
    labels = {c["label"] for c in classifications}
    if "Possible Memory Leak" in labels or "Growing" in labels:
        parts.append("Memory has been trending upward in recent samples.")
    elif "High Memory Usage" in labels:
        parts.append("Memory footprint is elevated relative to typical desktop processes.")
    elif "Busy" in labels:
        parts.append("CPU utilization is elevated.")
    else:
        parts.append("No abnormal behavior detected in collected metrics.")
    return " ".join(parts)


def inspect(pid: int) -> dict | None:
    proc = _safe_proc(pid)
    if not proc:
        return None

    now = time.time()
    with proc.oneshot():
        try:
            name = proc.name()
            create_time = proc.create_time()
            runtime_seconds = max(0, int(now - create_time))
            mem_info = proc.memory_info()
            mem_bytes = int(mem_info.rss)
            cpu_pct = round(float(proc.cpu_percent(interval=0.05)), 2)
            num_threads = proc.num_threads()
            num_handles = proc.num_handles() if hasattr(proc, "num_handles") else None
            ppid = proc.ppid()
            username = proc.username() if hasattr(proc, "username") else None
            exe = proc.exe() if hasattr(proc, "exe") else None
            cmdline = proc.cmdline() if hasattr(proc, "cmdline") else []
            status = proc.status()
        except (psutil.NoSuchProcess, psutil.AccessDenied) as exc:
            logger.debug("Process inspect failed pid=%s: %s", pid, exc)
            return None

    io_read = io_write = None
    try:
        io = proc.io_counters()
        io_read = int(io.read_bytes)
        io_write = int(io.write_bytes)
    except (psutil.AccessDenied, AttributeError):
        pass

    connections: list[dict] = []
    try:
        for conn in proc.connections(kind="inet")[:30]:
            connections.append(
                {
                    "localAddress": f"{conn.laddr.ip}:{conn.laddr.port}" if conn.laddr else None,
                    "remoteAddress": f"{conn.raddr.ip}:{conn.raddr.port}" if conn.raddr else None,
                    "status": conn.status,
                    "protocol": "TCP" if conn.type.name == "SOCK_STREAM" else "UDP",
                }
            )
    except (psutil.AccessDenied, AttributeError):
        pass

    window_title = read_process_window_title(pid)
    signature = read_executable_signature(exe) if exe else {"available": False, "status": "unknown"}

    trend = get_process_memory_trend(pid)
    classifications = _classify_process(proc, cpu_pct, mem_bytes, trend, len(connections), io_read, io_write)
    summary = _build_summary(name, cpu_pct, mem_bytes, num_threads, len(connections), classifications)

    return {
        "pid": pid,
        "name": name,
        "parentPid": ppid,
        "executablePath": exe,
        "commandLine": " ".join(cmdline) if cmdline else None,
        "startTime": int(create_time * 1000),
        "runtimeSeconds": runtime_seconds,
        "threadCount": num_threads,
        "handleCount": num_handles,
        "cpuPercent": cpu_pct,
        "memoryBytes": mem_bytes,
        "privateBytes": int(getattr(mem_info, "private", mem_bytes)),
        "virtualBytes": int(getattr(mem_info, "vms", 0)),
        "diskReadBytes": io_read,
        "diskWriteBytes": io_write,
        "connections": connections,
        "connectionCount": len(connections),
        "windowTitle": window_title,
        "digitalSignature": signature,
        "status": status,
        "username": username,
        "classifications": classifications,
        "aiSummary": summary,
        "memoryTrend": trend,
    }
