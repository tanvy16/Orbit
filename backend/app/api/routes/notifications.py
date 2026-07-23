from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.api.schemas import NotificationCreate
from backend.app.database.session import get_db
from backend.app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _serialize(row) -> dict:
    return {
        "id": row.id,
        "title": row.title,
        "body": row.body,
        "category": row.category,
        "level": row.level,
        "read": row.read,
        "createdAt": row.created_at.isoformat()
        if isinstance(row.created_at, datetime)
        else str(row.created_at),
    }


@router.get("")
def list_notifications(
    unreadOnly: bool = False,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[dict]:
    rows = NotificationService(db).list_notifications(unreadOnly, limit)
    return [_serialize(row) for row in rows]


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db)) -> dict:
    return {"count": NotificationService(db).unread_count()}


@router.post("")
def create_notification(payload: NotificationCreate, db: Session = Depends(get_db)) -> dict:
    row = NotificationService(db).create(payload)
    return _serialize(row)


@router.post("/{notification_id}/read")
def mark_read(notification_id: int, db: Session = Depends(get_db)) -> dict:
    NotificationService(db).mark_read(notification_id)
    return {"ok": True}


@router.post("/read-all")
def mark_all_read(db: Session = Depends(get_db)) -> dict:
    NotificationService(db).mark_all_read()
    return {"ok": True}
