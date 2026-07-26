from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from backend.observability.models import EventLogRecord


class EventLogger:
    """Structured event log for AI, automation, and system actions."""

    CATEGORIES = frozenset({"ai", "automation", "system", "desktop", "error"})

    def __init__(self, db: Session) -> None:
        self.db = db

    def record(
        self,
        *,
        category: str,
        action: str,
        status: str,
        user_command: str | None = None,
        intent: str | None = None,
        model: str | None = None,
        route: str | None = None,
        duration_ms: float | None = None,
        verified: bool | None = None,
        error_message: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> EventLogRecord:
        row = EventLogRecord(
            category=category,
            action=action,
            status=status,
            user_command=(user_command or "")[:4000] or None,
            intent=intent,
            model=model,
            route=route,
            duration_ms=duration_ms,
            verified=verified,
            error_message=(error_message or "")[:4000] or None,
            metadata_json=json.dumps(metadata or {}),
            created_at=datetime.now(timezone.utc),
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def list_recent(
        self,
        *,
        limit: int = 100,
        category: str | None = None,
        status: str | None = None,
        search: str | None = None,
    ) -> list[EventLogRecord]:
        stmt = select(EventLogRecord).order_by(desc(EventLogRecord.created_at)).limit(limit)
        if category:
            stmt = stmt.where(EventLogRecord.category == category)
        if status:
            stmt = stmt.where(EventLogRecord.status == status)
        if search:
            like = f"%{search.strip()}%"
            stmt = stmt.where(
                EventLogRecord.user_command.ilike(like)
                | EventLogRecord.action.ilike(like)
                | EventLogRecord.intent.ilike(like)
            )
        return list(self.db.scalars(stmt).all())

    @staticmethod
    def serialize(row: EventLogRecord) -> dict[str, Any]:
        try:
            metadata = json.loads(row.metadata_json or "{}")
        except json.JSONDecodeError:
            metadata = {}
        return {
            "id": row.id,
            "category": row.category,
            "action": row.action,
            "status": row.status,
            "userCommand": row.user_command,
            "intent": row.intent,
            "model": row.model,
            "route": row.route,
            "durationMs": row.duration_ms,
            "verified": row.verified,
            "errorMessage": row.error_message,
            "metadata": metadata,
            "timestamp": row.created_at.isoformat() if row.created_at else None,
        }
