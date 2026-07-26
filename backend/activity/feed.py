from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from backend.app.services.notification_service import NotificationService
from backend.app.services.task_service import TaskService
from backend.history.logger import ActionHistoryLogger


def _parse_ts(value: str | datetime | None) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            pass
    return datetime.min


def build_activity_feed(db: Session, *, limit: int = 50) -> list[dict[str, Any]]:
    """Merge notifications, action history, and background tasks into one timeline."""
    items: list[dict[str, Any]] = []

    for row in NotificationService(db).list_notifications(unread_only=False, limit=limit):
        items.append(
            {
                "id": f"notification-{row.id}",
                "kind": "notification",
                "title": row.title,
                "detail": row.body,
                "level": row.level,
                "category": row.category,
                "timestamp": row.created_at.isoformat() if row.created_at else None,
                "read": row.read,
            }
        )

    for row in ActionHistoryLogger(db).list_recent(limit=limit):
        serialized = ActionHistoryLogger.serialize(row)
        status = serialized.get("executionStatus") or "pending"
        intent = serialized.get("detectedIntent") or serialized.get("actionType") or "action"
        target = serialized.get("target")
        detail_parts = [intent.replace("_", " ")]
        if target:
            detail_parts.append(str(target))
        items.append(
            {
                "id": f"history-{serialized.get('id')}",
                "kind": "action",
                "title": _history_title(serialized),
                "detail": " · ".join(detail_parts),
                "level": "success" if status == "success" else "error" if status == "failed" else "info",
                "category": serialized.get("source") or "copilot",
                "timestamp": serialized.get("createdAt"),
                "status": status,
                "source": serialized.get("source"),
            }
        )

    for task_row in TaskService(db).list_recent(limit=limit):
        status = task_row.status
        if status not in {"running", "completed", "failed", "queued"}:
            continue
        ts = task_row.completed_at or task_row.started_at or task_row.updated_at or task_row.created_at
        items.append(
            {
                "id": f"task-{task_row.id}",
                "kind": "task",
                "title": f"{task_row.task_type.replace('_', ' ').title()}",
                "detail": task_row.current_path or task_row.error_message or status,
                "level": "success" if status == "completed" else "error" if status == "failed" else "info",
                "category": "indexing",
                "timestamp": ts.isoformat() if ts else None,
                "status": status,
                "progress": task_row.progress_percent,
            }
        )

    items.sort(key=lambda item: _parse_ts(item.get("timestamp")), reverse=True)
    return items[:limit]


def _history_title(entry: dict[str, Any]) -> str:
    status = entry.get("executionStatus") or "pending"
    command = (entry.get("userCommand") or "").strip()
    if command and len(command) <= 80:
        prefix = "Executed" if status == "success" else "Failed" if status == "failed" else "Planned"
        return f"{prefix}: {command}"
    intent = (entry.get("detectedIntent") or entry.get("actionType") or "Desktop action").replace("_", " ")
    if status == "success":
        return f"{intent.title()} completed"
    if status == "failed":
        return f"{intent.title()} failed"
    return f"{intent.title()} planned"
