"""Tests for automation workflow parsing."""

from backend.automation.workflow_parser import parse_workflow_description


def test_parse_multi_step_workflow():
    preview = parse_workflow_description("Open Chrome, VS Code and Downloads")
    assert preview["name"]
    assert len(preview["steps"]) >= 2
    assert any(step["actionType"] == "launch_app" for step in preview["steps"])


def test_parse_coding_setup_preset():
    preview = parse_workflow_description("Start my coding setup")
    assert len(preview["steps"]) >= 2
