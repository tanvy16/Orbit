"""Tests for Phase 5.2.1 action history logging."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.actions.action_executor import try_action_response
from backend.actions.types import ActionPlan
from backend.app.models.base import Base
from backend.history.logger import ActionHistoryLogger
from backend.history.models import ActionHistoryRecord


@pytest.fixture()
def history_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine, tables=[ActionHistoryRecord.__table__])
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


def test_record_planned_creates_entry(history_db):
    plan = ActionPlan(
        action_type="launch_app",
        params={"app": "Chrome", "key": "chrome"},
        log_message="app:launch:chrome",
        action_id="test-action-1",
    )
    row = ActionHistoryLogger(history_db).record_planned(user_command="Open Chrome", plan=plan)
    assert row.id is not None
    assert row.user_command == "Open Chrome"
    assert row.detected_intent == "launch_application"
    assert row.action_type == "launch_app"
    assert row.execution_status == "pending"
    assert json.loads(row.parameters_json)["target"] == "chrome"


def test_record_execution_updates_entry(history_db):
    plan = ActionPlan(action_type="launch_app", params={"app": "Chrome"}, action_id="exec-1")
    logger = ActionHistoryLogger(history_db)
    logger.record_planned(user_command="Open Chrome", plan=plan)
    updated = logger.record_execution(
        action_id="exec-1",
        execution_status="success",
        execution_time_ms=42.5,
    )
    assert updated is not None
    assert updated.execution_status == "success"
    assert updated.execution_time_ms == 42.5
    assert updated.executed_at is not None


def test_list_recent_and_get_by_id(history_db):
    logger = ActionHistoryLogger(history_db)
    plan = ActionPlan(action_type="open_folder", params={"folder": "Downloads"}, action_id="folder-1")
    row = logger.record_planned(user_command="Open Downloads", plan=plan)
    items = logger.list_recent(limit=10)
    assert len(items) == 1
    fetched = logger.get_by_id(row.id)
    assert fetched is not None
    assert fetched.user_command == "Open Downloads"


def test_serialize_shape(history_db):
    plan = ActionPlan(action_type="close_process", params={"target": "chrome"}, action_id="close-1")
    row = ActionHistoryLogger(history_db).record_planned(user_command="Close Chrome", plan=plan)
    payload = ActionHistoryLogger.serialize(row)
    assert payload["userCommand"] == "Close Chrome"
    assert payload["detectedIntent"] == "close_process"
    assert payload["executionStatus"] == "pending"
    assert payload["actionId"] == "close-1"


def test_try_action_response_records_history():
    db = MagicMock()
    with patch("backend.actions.action_executor.SettingsService") as settings_cls:
        settings_cls.return_value.get_settings.return_value = {
            "copilotProvider": "ollama",
            "copilotModel": "test-model",
        }
        with patch("backend.actions.action_executor.ActionHistoryLogger") as history_cls:
            history = history_cls.return_value
            response = try_action_response(db, "Open Notepad")
    assert response is not None
    history.record_planned.assert_called_once()
    _args, kwargs = history.record_planned.call_args
    assert kwargs["user_command"] == "Open Notepad"
    assert kwargs["source"] == "copilot"
