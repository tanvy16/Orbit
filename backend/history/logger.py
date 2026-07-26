from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import desc, or_, select
from sqlalchemy.orm import Session

from backend.actions.types import ActionPlan
from backend.history.models import ActionHistoryRecord

_INTENT_ALIASES: dict[str, str] = {
    "launch_app": "launch_application",
    "open_folder": "open_folder",
    "open_file": "open_file",
    "file_search": "file_search",
    "file_create_folder": "create_folder",
    "file_create_text": "create_text_file",
    "file_rename": "rename_file",
    "file_move": "move_file",
    "file_copy": "copy_file",
    "file_delete": "delete_file",
    "close_process": "close_process",
    "restart_process": "restart_process",
    "list_processes": "list_processes",
    "clipboard_intelligence": "clipboard_intelligence",
    "system_shutdown": "system_shutdown",
    "system_restart": "system_restart",
}


def _resolve_intent(action_type: str) -> str:
    return _INTENT_ALIASES.get(action_type, action_type)


def extract_target(params: dict[str, Any]) -> str | None:
    for key in ("target", "key", "app", "folder", "path", "query", "name", "processName"):
        value = params.get(key)
        if value:
            return str(value)
    return None


class ActionHistoryLogger:
    """Records and queries persistent action execution history."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def record_planned(
        self,
        *,
        user_command: str,
        plan: ActionPlan,
        source: str = "copilot",
    ) -> ActionHistoryRecord:
        params = dict(plan.params)
        target = extract_target(params)
        if target and "target" not in params:
            params["target"] = target

        existing = self.db.scalar(
            select(ActionHistoryRecord).where(ActionHistoryRecord.action_id == plan.action_id)
        )
        if existing:
            existing.user_command = user_command.strip()
            existing.detected_intent = _resolve_intent(plan.action_type)
            existing.action_type = plan.action_type
            existing.parameters_json = json.dumps(params)
            existing.execution_status = "pending"
            existing.error_message = None
            existing.source = source
            self.db.commit()
            self.db.refresh(existing)
            return existing

        row = ActionHistoryRecord(
            action_id=plan.action_id,
            user_command=user_command.strip(),
            detected_intent=_resolve_intent(plan.action_type),
            action_type=plan.action_type,
            parameters_json=json.dumps(params),
            execution_status="pending",
            source=source,
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def record_execution(
        self,
        *,
        action_id: str,
        execution_status: str,
        execution_time_ms: float | None = None,
        error_message: str | None = None,
        parameters: dict[str, Any] | None = None,
    ) -> ActionHistoryRecord | None:
        row = self.db.scalar(
            select(ActionHistoryRecord).where(ActionHistoryRecord.action_id == action_id)
        )
        if not row:
            return None

        row.execution_status = execution_status
        row.execution_time_ms = execution_time_ms
        row.error_message = error_message
        row.executed_at = datetime.now(timezone.utc)
        if parameters:
            try:
                merged = json.loads(row.parameters_json or "{}")
                merged.update(parameters)
                row.parameters_json = json.dumps(merged)
            except json.JSONDecodeError:
                row.parameters_json = json.dumps(parameters)
        self.db.commit()
        self.db.refresh(row)
        return row

    def list_recent(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
        status: str | None = None,
        search: str | None = None,
    ) -> list[ActionHistoryRecord]:
        stmt = select(ActionHistoryRecord).order_by(desc(ActionHistoryRecord.created_at))
        if status:
            stmt = stmt.where(ActionHistoryRecord.execution_status == status)
        if search:
            like = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    ActionHistoryRecord.user_command.ilike(like),
                    ActionHistoryRecord.action_type.ilike(like),
                    ActionHistoryRecord.detected_intent.ilike(like),
                    ActionHistoryRecord.parameters_json.ilike(like),
                )
            )
        stmt = stmt.offset(offset).limit(limit)
        return list(self.db.scalars(stmt).all())

    def get_by_id(self, entry_id: int) -> ActionHistoryRecord | None:
        return self.db.get(ActionHistoryRecord, entry_id)

    def clear_all(self) -> int:
        rows = list(self.db.scalars(select(ActionHistoryRecord)).all())
        count = len(rows)
        for row in rows:
            self.db.delete(row)
        self.db.commit()
        return count

    @staticmethod
    def serialize(row: ActionHistoryRecord) -> dict[str, Any]:
        try:
            parameters = json.loads(row.parameters_json or "{}")
        except json.JSONDecodeError:
            parameters = {}

        timestamp = row.executed_at or row.created_at
        return {
            "id": row.id,
            "actionId": row.action_id,
            "timestamp": timestamp.isoformat() if timestamp else None,
            "createdAt": row.created_at.isoformat() if row.created_at else None,
            "executedAt": row.executed_at.isoformat() if row.executed_at else None,
            "userCommand": row.user_command,
            "detectedIntent": row.detected_intent,
            "actionType": row.action_type,
            "parameters": parameters,
            "target": parameters.get("target"),
            "executionStatus": row.execution_status,
            "executionTimeMs": row.execution_time_ms,
            "errorMessage": row.error_message,
            "source": row.source,
        }
