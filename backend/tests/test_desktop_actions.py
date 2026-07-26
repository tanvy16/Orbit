"""Tests for desktop action classification and routing."""

from backend.actions.action_executor import try_action_response
from backend.actions.classifier import classify_desktop_action
from backend.ai.intent import classify_intents
from backend.ai.query_patterns import is_desktop_action_query


def test_launch_app_classification():
    plan = classify_desktop_action("Open Chrome")
    assert plan is not None
    assert plan.action_type == "launch_app"
    assert plan.params["app"] == "Chrome"


def test_open_folder_classification():
    plan = classify_desktop_action("Open Downloads")
    assert plan is not None
    assert plan.action_type == "open_folder"


def test_file_search_classification():
    plan = classify_desktop_action("Find my resume")
    assert plan is not None
    assert plan.action_type == "file_search"


def test_delete_requires_confirmation():
    plan = classify_desktop_action("Delete file old-notes.txt")
    assert plan is not None
    assert plan.action_type == "file_delete"
    assert plan.requires_confirmation is True


def test_clipboard_classification():
    plan = classify_desktop_action("Summarize clipboard")
    assert plan is not None
    assert plan.action_type == "clipboard_intelligence"
    assert plan.params["operation"] == "summarize"


def test_telemetry_not_desktop_action():
    assert is_desktop_action_query("What is my CPU usage?") is False
    intents = classify_intents("What is my CPU usage?")
    assert intents.get("desktop_action") is False


def test_document_search_not_desktop_action():
    assert is_desktop_action_query("What documents mention machine learning?") is False


def test_desktop_action_intent():
    intents = classify_intents("Open VS Code")
    assert intents["desktop_action"] is True
    assert intents["direct_answer"] is True
    assert intents["needs_llm"] is False


def test_try_action_response_shape():
    from unittest.mock import MagicMock, patch

    db = MagicMock()
    with patch("backend.actions.action_executor.SettingsService") as settings_cls:
        settings_cls.return_value.get_settings.return_value = {
            "copilotProvider": "ollama",
            "copilotModel": "test-model",
        }
        with patch("backend.actions.action_executor.execute_desktop_plan") as execute_mock:
            execute_mock.return_value = {"ok": True, "message": "Notepad launched successfully."}
            with patch("backend.actions.action_executor.ActionHistoryLogger"):
                response = try_action_response(db, "Open Notepad")
    assert response is not None
    assert response["desktopAction"] is True
    assert response["desktopActionPlan"]["type"] == "launch_app"
    assert "✓" in response["reply"]
    execute_mock.assert_called_once()
