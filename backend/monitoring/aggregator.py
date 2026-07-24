from __future__ import annotations

import time

import psutil

from backend.monitoring import battery, cpu, disk, gpu, memory, network, processes


def collect_snapshot() -> dict:
    proc = processes.snapshot()
    return {
        "timestamp": int(time.time() * 1000),
        "cpu": cpu.snapshot(),
        "memory": memory.snapshot(proc["items"]),
        "disk": disk.snapshot(),
        "network": network.snapshot(),
        "battery": battery.snapshot(),
        "gpu": gpu.snapshot(),
        "processes": proc,
    }


def collect_light_snapshot() -> dict:
    """Fast telemetry without scanning running processes."""
    try:
        process_count = len(psutil.pids())
    except Exception:
        process_count = 0
    return {
        "timestamp": int(time.time() * 1000),
        "cpu": cpu.snapshot(),
        "memory": memory.snapshot([]),
        "disk": disk.snapshot(),
        "network": network.snapshot(),
        "battery": battery.snapshot(),
        "gpu": gpu.snapshot(),
        "processes": {"count": process_count, "items": []},
    }
