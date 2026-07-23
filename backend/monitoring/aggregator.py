from __future__ import annotations

import time

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
