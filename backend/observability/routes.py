from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.database.session import get_db
from backend.observability.diagnostics_store import list_diagnostics
from backend.observability.event_logger import EventLogger
from backend.observability.metrics_service import HistoricalMetricsService

router = APIRouter(prefix="/observability", tags=["observability"])


@router.get("/events")
def list_events(
    limit: int = Query(100, ge=1, le=500),
    category: str | None = None,
    status: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
) -> dict:
    rows = EventLogger(db).list_recent(limit=limit, category=category, status=status, search=search)
    return {"items": [EventLogger.serialize(row) for row in rows], "count": len(rows)}


@router.get("/diagnostics")
def diagnostics(limit: int = Query(50, ge=1, le=200)) -> dict:
    items = list_diagnostics(limit=limit)
    return {"items": items, "count": len(items)}


@router.get("/metrics/history")
def metrics_history(
    metric: str = Query(..., pattern="^(cpu|ram|disk|network_down|network_up)$"),
    hours: float = Query(1.0, ge=0.25, le=48.0),
    db: Session = Depends(get_db),
) -> dict:
    points = HistoricalMetricsService(db).query(metric, hours=hours)
    return {"metric": metric, "hours": hours, "points": points, "count": len(points)}
