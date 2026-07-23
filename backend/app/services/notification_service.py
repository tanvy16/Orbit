from __future__ import annotations

import json
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.api.schemas import NotificationCreate
from backend.app.models.entities import NotificationRecord


class NotificationService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, payload: NotificationCreate) -> NotificationRecord:
        row = NotificationRecord(
            title=payload.title,
            body=payload.body,
            category=payload.category,
            level=payload.level,
            meta_json=json.dumps(payload.meta),
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def list_notifications(self, unread_only: bool, limit: int) -> list[NotificationRecord]:
        query = select(NotificationRecord).order_by(NotificationRecord.created_at.desc()).limit(limit)
        if unread_only:
            query = query.where(NotificationRecord.read.is_(False))
        return list(self.db.scalars(query).all())

    def unread_count(self) -> int:
        return self.db.scalar(
            select(func.count()).where(NotificationRecord.read.is_(False))
        ) or 0

    def mark_read(self, notification_id: int) -> None:
        row = self.db.get(NotificationRecord, notification_id)
        if row:
            row.read = True
            self.db.commit()

    def mark_all_read(self) -> None:
        rows = self.db.scalars(select(NotificationRecord).where(NotificationRecord.read.is_(False))).all()
        for row in rows:
            row.read = True
        self.db.commit()
