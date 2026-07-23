from __future__ import annotations

import json
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.api.schemas import TaskCreate, TaskUpdate
from backend.app.models.entities import BackgroundTask


class TaskService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, payload: TaskCreate) -> BackgroundTask:
        existing = self.db.get(BackgroundTask, payload.id)
        if existing:
            return existing
        row = BackgroundTask(
            id=payload.id,
            task_type=payload.taskType,
            status=payload.status,
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def update(self, task_id: str, payload: TaskUpdate) -> BackgroundTask:
        row = self.db.get(BackgroundTask, task_id)
        if not row:
            raise ValueError("Task not found")
        if payload.status is not None:
            row.status = payload.status
            if payload.status == "running" and not row.started_at:
                row.started_at = datetime.now(UTC)
            if payload.status in {"completed", "failed", "cancelled"}:
                row.completed_at = datetime.now(UTC)
        if payload.progressPercent is not None:
            row.progress_percent = payload.progressPercent
        if payload.currentPath is not None:
            row.current_path = payload.currentPath
        if payload.stats is not None:
            row.stats_json = json.dumps(payload.stats)
        if payload.error is not None:
            row.error_message = payload.error
        self.db.commit()
        self.db.refresh(row)
        return row

    def list_active(self) -> list[BackgroundTask]:
        return list(
            self.db.scalars(
                select(BackgroundTask).where(BackgroundTask.status.in_(("queued", "running")))
            ).all()
        )

    def list_recent(self, limit: int = 20) -> list[BackgroundTask]:
        return list(
            self.db.scalars(
                select(BackgroundTask).order_by(BackgroundTask.updated_at.desc()).limit(limit)
            ).all()
        )
