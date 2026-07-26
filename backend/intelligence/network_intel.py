from __future__ import annotations

import time

import psutil

from backend.app.core.logging import logger
from backend.intelligence.platform_win import read_dns_cache
from backend.monitoring import network as net_monitor


def collect() -> dict:
    base = net_monitor.snapshot()
    now = int(time.time() * 1000)
    connections: list[dict] = []
    protocols: dict[str, int] = {}
    apps: dict[str, int] = {}

    try:
        for conn in psutil.net_connections(kind="inet")[:150]:
            proto = "TCP" if conn.type.name == "SOCK_STREAM" else "UDP"
            protocols[proto] = protocols.get(proto, 0) + 1
            proc_name = None
            pid = conn.pid
            if pid:
                try:
                    proc_name = psutil.Process(pid).name()
                    apps[proc_name] = apps.get(proc_name, 0) + 1
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    proc_name = None
            local = f"{conn.laddr.ip}:{conn.laddr.port}" if conn.laddr else None
            remote = f"{conn.raddr.ip}:{conn.raddr.port}" if conn.raddr else None
            connections.append(
                {
                    "id": f"{proto}-{local}-{remote}-{pid}",
                    "timestamp": now,
                    "protocol": proto,
                    "localAddress": local,
                    "remoteAddress": remote,
                    "localPort": conn.laddr.port if conn.laddr else None,
                    "remotePort": conn.raddr.port if conn.raddr else None,
                    "status": conn.status,
                    "pid": pid,
                    "processName": proc_name,
                    "applicationName": proc_name,
                }
            )
    except (psutil.AccessDenied, PermissionError) as exc:
        logger.debug("Network connections unavailable: %s", exc)

    app_traffic = sorted(
        [{"name": k, "connectionCount": v} for k, v in apps.items()],
        key=lambda x: x["connectionCount"],
        reverse=True,
    )[:10]

    dns_entries = read_dns_cache(15)

    down = float(base.get("downloadBytesPerSec", 0))
    up = float(base.get("uploadBytesPerSec", 0))
    summary_parts = [f"Throughput: {down / 1024:.0f} KB/s down, {up / 1024:.0f} KB/s up."]
    if app_traffic:
        top = app_traffic[0]
        summary_parts.append(f"{top['name']} has {top['connectionCount']} active connections.")
    https_count = sum(1 for c in connections if c.get("remotePort") == 443)
    if https_count:
        summary_parts.append(f"{https_count} connections use port 443 (typical HTTPS).")
    summary_parts.append("No threat intelligence available — traffic is not classified as malicious.")

    return {
        **base,
        "totalBandwidthBytesPerSec": down + up,
        "connections": connections[:80],
        "connectionCount": len(connections),
        "protocolBreakdown": protocols,
        "applications": app_traffic,
        "dnsEntries": dns_entries,
        "aiSummary": " ".join(summary_parts),
    }


def get_connection_detail(connection_id: str, connections: list[dict]) -> dict | None:
    for conn in connections:
        if conn.get("id") == connection_id:
            proc = conn.get("processName") or "unknown"
            remote = conn.get("remoteAddress") or "unknown"
            proto = conn.get("protocol") or "TCP"
            return {
                **conn,
                "aiSummary": (
                    f"{proc} maintains a {proto} connection to {remote}. "
                    "Traffic patterns are consistent with normal application networking; "
                    "no malicious classification is available."
                ),
            }
    return None
