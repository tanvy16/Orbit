from __future__ import annotations

import threading
import time
from collections import deque
from typing import Any

_lock = threading.Lock()
_events: deque[dict[str, Any]] = deque(maxlen=500)
_process_memory: dict[int, list[tuple[float, int]]] = {}
_last_snapshot: dict[str, Any] | None = None
_known_pids: dict[int, str] = {}


def _emit(event_type: str, message: str, *, metadata: dict[str, Any] | None = None) -> None:
    entry = {
        "id": f"{int(time.time() * 1000)}-{event_type}",
        "type": event_type,
        "message": message,
        "timestamp": int(time.time() * 1000),
        "metadata": metadata or {},
    }
    with _lock:
        _events.appendleft(entry)


def observe_snapshot(snapshot: dict[str, Any]) -> None:
    """Compare successive snapshots and emit timeline events."""
    global _last_snapshot, _known_pids
    with _lock:
        prev = _last_snapshot
        _last_snapshot = snapshot

    if not prev:
        _emit("system", "System Intelligence monitoring started")
        _seed_processes(snapshot)
        return

    cpu = float(snapshot.get("cpu", {}).get("usagePercent", 0))
    prev_cpu = float(prev.get("cpu", {}).get("usagePercent", 0))
    if cpu >= 85 and prev_cpu < 75:
        _emit("cpu_spike", f"High CPU detected ({cpu:.0f}%)", metadata={"usagePercent": cpu})

    mem_pct = float(snapshot.get("memory", {}).get("usagePercent", 0))
    prev_mem = float(prev.get("memory", {}).get("usagePercent", 0))
    if mem_pct >= 85 and prev_mem < 75:
        _emit("memory_spike", f"Memory spike detected ({mem_pct:.0f}%)", metadata={"usagePercent": mem_pct})

    net_down = float(snapshot.get("network", {}).get("downloadBytesPerSec", 0))
    prev_down = float(prev.get("network", {}).get("downloadBytesPerSec", 0))
    if net_down >= 5 * 1024 * 1024 and prev_down < 1024 * 1024:
        _emit("network", f"Large download activity ({net_down / (1024 * 1024):.1f} MB/s)", metadata={"downloadBps": net_down})

    bat = snapshot.get("battery", {})
    prev_bat = prev.get("battery", {})
    if bat.get("available") and prev_bat.get("available"):
        if bat.get("charging") and not prev_bat.get("charging"):
            _emit("battery", "Battery connected — charging started")
        elif not bat.get("charging") and prev_bat.get("charging"):
            _emit("battery", "Power disconnected — running on battery")

    current: dict[int, str] = {}
    for proc in snapshot.get("processes", {}).get("items") or []:
        pid = int(proc.get("pid") or 0)
        name = str(proc.get("name") or "unknown")
        if pid <= 0:
            continue
        current[pid] = name
        with _lock:
            history = _process_memory.setdefault(pid, [])
            mem = int(proc.get("memoryBytes") or 0)
            history.append((time.time(), mem))
            if len(history) > 12:
                _process_memory[pid] = history[-12:]

    for pid, name in current.items():
        if pid not in _known_pids:
            _emit("process_start", f"{name} started", metadata={"pid": pid, "name": name})

    for pid, name in list(_known_pids.items()):
        if pid not in current:
            _emit("process_stop", f"{name} closed", metadata={"pid": pid, "name": name})

    with _lock:
        _known_pids = current


def _seed_processes(snapshot: dict[str, Any]) -> None:
    global _known_pids
    current: dict[int, str] = {}
    for proc in snapshot.get("processes", {}).get("items") or []:
        pid = int(proc.get("pid") or 0)
        if pid > 0:
            current[pid] = str(proc.get("name") or "unknown")
    with _lock:
        _known_pids = current


def get_timeline(limit: int = 50, search: str | None = None) -> list[dict[str, Any]]:
    with _lock:
        items = list(_events)
    if search:
        q = search.strip().lower()
        items = [e for e in items if q in e.get("message", "").lower() or q in e.get("type", "").lower()]
    return items[:limit]


def get_process_memory_trend(pid: int) -> list[dict[str, Any]]:
    with _lock:
        history = _process_memory.get(pid, [])
    return [{"recordedAt": int(ts * 1000), "memoryBytes": mem} for ts, mem in history]
