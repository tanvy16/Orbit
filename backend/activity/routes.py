from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.activity.feed import build_activity_feed
from backend.app.database.session import get_db

router = APIRouter(prefix="/activity", tags=["activity"])


@router.get("")
def list_activity(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> dict:
    items = build_activity_feed(db, limit=limit)
    return {"items": items, "count": len(items)}
