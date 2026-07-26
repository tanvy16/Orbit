from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.database.session import get_db
from backend.history.logger import ActionHistoryLogger

router = APIRouter(prefix="/history", tags=["history"])


class RecordExecutionRequest(BaseModel):
    actionId: str = Field(min_length=1, max_length=64)
    executionStatus: str = Field(pattern="^(success|failed|cancelled)$")
    executionTimeMs: float | None = Field(default=None, ge=0)
    errorMessage: str | None = Field(default=None, max_length=4000)
    parameters: dict | None = None


@router.get(
    "",
    summary="List recent action history",
    description="Returns recent Copilot and Automation action executions, newest first.",
)
def list_history(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status: str | None = Query(default=None, description="Filter by execution status"),
    search: str | None = Query(default=None, max_length=200),
    db: Session = Depends(get_db),
) -> dict:
    rows = ActionHistoryLogger(db).list_recent(limit=limit, offset=offset, status=status, search=search)
    return {
        "items": [ActionHistoryLogger.serialize(row) for row in rows],
        "count": len(rows),
        "limit": limit,
        "offset": offset,
    }


@router.get(
    "/{entry_id}",
    summary="Get action history detail",
    description="Returns full execution details for a single history entry.",
)
def get_history_entry(entry_id: int, db: Session = Depends(get_db)) -> dict:
    row = ActionHistoryLogger(db).get_by_id(entry_id)
    if not row:
        raise HTTPException(status_code=404, detail="History entry not found")
    return ActionHistoryLogger.serialize(row)


@router.post(
    "/record",
    summary="Record action execution result",
    description="Updates a pending history entry after Electron executes a desktop action.",
)
def record_execution(payload: RecordExecutionRequest, db: Session = Depends(get_db)) -> dict:
    row = ActionHistoryLogger(db).record_execution(
        action_id=payload.actionId,
        execution_status=payload.executionStatus,
        execution_time_ms=payload.executionTimeMs,
        error_message=payload.errorMessage,
        parameters=payload.parameters,
    )
    if not row:
        raise HTTPException(status_code=404, detail="History entry not found for actionId")
    return ActionHistoryLogger.serialize(row)


@router.delete(
    "",
    summary="Clear action history",
    description="Deletes all action history entries.",
)
def clear_history(db: Session = Depends(get_db)) -> dict:
    deleted = ActionHistoryLogger(db).clear_all()
    return {"deleted": deleted}
