from __future__ import annotations

from datetime import datetime
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.api.schemas import TaskCreate, TaskUpdate
from backend.app.database.session import get_db
from backend.app.services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _serialize(row) -> dict:
    try:
        stats = json.loads(row.stats_json or "{}")
    except json.JSONDecodeError:
        stats = {}
    return {
        "id": row.id,
        "taskType": row.task_type,
        "status": row.status,
        "progressPercent": row.progress_percent,
        "currentPath": row.current_path,
        "stats": stats,
        "error": row.error_message,
        "startedAt": row.started_at.isoformat() if row.started_at else None,
        "completedAt": row.completed_at.isoformat() if row.completed_at else None,
    }


@router.get("")
def list_tasks(db: Session = Depends(get_db)) -> list[dict]:
    return [_serialize(row) for row in TaskService(db).list_recent()]


@router.get("/active")
def list_active_tasks(db: Session = Depends(get_db)) -> list[dict]:
    return [_serialize(row) for row in TaskService(db).list_active()]


@router.post("")
def create_task(payload: TaskCreate, db: Session = Depends(get_db)) -> dict:
    row = TaskService(db).create(payload)
    return _serialize(row)


@router.patch("/{task_id}")
def update_task(task_id: str, payload: TaskUpdate, db: Session = Depends(get_db)) -> dict:
    try:
        row = TaskService(db).update(task_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _serialize(row)
