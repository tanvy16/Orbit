from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from backend.intelligence import network_intel, process_intel
from backend.intelligence import service as intel_service
from backend.intelligence.timeline import get_timeline

router = APIRouter(prefix="/intelligence", tags=["intelligence"])


@router.get("/overview")
def intelligence_overview() -> dict:
    return intel_service.build_overview()


@router.get("/cpu")
def intelligence_cpu() -> dict:
    return intel_service.build_cpu_view()


@router.get("/memory")
def intelligence_memory() -> dict:
    return intel_service.build_memory_view()


@router.get("/storage")
def intelligence_storage() -> dict:
    return intel_service.build_storage_view()


@router.get("/network")
def intelligence_network() -> dict:
    return intel_service.build_network_view()


@router.get("/kernel")
def intelligence_kernel() -> dict:
    return intel_service.build_kernel_view()


@router.get("/gpu")
def intelligence_gpu() -> dict:
    return intel_service.build_gpu_view()


@router.get("/battery")
def intelligence_battery() -> dict:
    return intel_service.build_battery_view()


@router.get("/process/{pid}")
def intelligence_process(pid: int) -> dict:
    detail = process_intel.inspect(pid)
    if not detail:
        raise HTTPException(status_code=404, detail="Process not found or access denied")
    return detail


@router.get("/timeline")
def intelligence_timeline(
    limit: int = Query(default=50, ge=1, le=200),
    search: str | None = Query(default=None),
) -> dict:
    items = get_timeline(limit, search=search)
    return {"items": items, "count": len(items)}


@router.get("/network/connection/{connection_id}")
def intelligence_connection(connection_id: str) -> dict:
    data = intel_service.build_network_view()
    connections = data.get("connections") or []
    detail = network_intel.get_connection_detail(connection_id, connections)
    if not detail:
        raise HTTPException(status_code=404, detail="Connection not found")
    return detail


@router.get("/history")
def intelligence_history(
    metric: str = Query(default="cpu"),
    hours: float = Query(default=1, ge=1 / 60, le=168),
) -> dict:
    allowed = {"cpu", "ram", "disk", "network_down", "network_up"}
    if metric not in allowed:
        raise HTTPException(status_code=400, detail=f"Unknown metric. Allowed: {', '.join(sorted(allowed))}")
    return intel_service.build_history(metric, hours)
