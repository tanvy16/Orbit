from __future__ import annotations

import re
from typing import Any

from backend.actions.classifier import classify_desktop_action
from backend.actions.types import ActionPlan
from backend.history.logger import extract_target


def parse_workflow_description(description: str) -> dict[str, Any]:
    """Convert natural language into a workflow preview."""
    trimmed = description.strip()
    if not trimmed:
        raise ValueError("Describe what Orbit should automate.")

    segments = _split_segments(trimmed)
    if len(segments) <= 1:
        segments = _expand_setup_phrase(trimmed)

    steps: list[dict[str, Any]] = []
    for segment in segments:
        command = _normalize_segment(segment)
        plan = classify_desktop_action(command)
        if not plan:
            continue
        target = extract_target(dict(plan.params)) or segment
        steps.append(
            {
                "stepNumber": len(steps) + 1,
                "actionType": plan.action_type,
                "target": target,
                "parameters": dict(plan.params),
                "label": _step_label(plan, segment),
            }
        )

    if not steps:
        raise ValueError(
            "I couldn't translate that request into executable desktop steps. "
            "Try commands like “Open Chrome, VS Code and Downloads”."
        )

    return {
        "name": _infer_workflow_name(trimmed),
        "description": trimmed,
        "steps": steps,
    }


def _normalize_segment(segment: str) -> str:
    text = segment.strip()
    if not text:
        return text
    lowered = text.lower()
    if re.match(r"^(open|launch|start|close|find|create|delete|move|copy|rename)\b", lowered):
        return text
    if lowered in {"chrome", "vscode", "vs code", "cursor", "spotify", "discord", "notepad", "file explorer"}:
        return f"Open {text}"
    if lowered in {"downloads", "documents", "desktop", "pictures", "music", "videos"}:
        return f"Open {text}"
    return f"Open {text}"


def _split_segments(text: str) -> list[str]:
    parts = re.split(r",|\band then\b|\bthen\b|\band\b", text, flags=re.IGNORECASE)
    cleaned = [part.strip(" .") for part in parts if part.strip(" .")]
    return cleaned


def _expand_setup_phrase(text: str) -> list[str]:
    lowered = text.lower()
    presets: dict[str, list[str]] = {
        "coding setup": ["Open Chrome", "Open VS Code", "Open Documents"],
        "development environment": ["Open VS Code", "Open Chrome", "Open Documents"],
        "gaming setup": ["Open Discord", "Open Spotify", "Open Chrome"],
        "work mode": ["Open VS Code", "Open File Explorer", "Open Documents"],
        "morning setup": ["Open Chrome", "Open VS Code", "Open Downloads"],
    }
    for key, commands in presets.items():
        if key in lowered:
            return commands
    return [text]


def _infer_workflow_name(text: str) -> str:
    cleaned = re.sub(
        r"^(?:please\s+)?(?:create|make|build|start|run|setup|set up)\s+(?:a\s+)?",
        "",
        text.strip(),
        flags=re.IGNORECASE,
    )
    cleaned = cleaned.strip(" .")
    if not cleaned:
        return "Custom Automation"
    words = cleaned.split()
    if len(words) > 5:
        cleaned = " ".join(words[:5])
    return cleaned[:1].upper() + cleaned[1:]


def _step_label(plan: ActionPlan, fallback: str) -> str:
    if plan.action_type == "launch_app":
        return f"Launch {plan.params.get('displayName') or plan.params.get('app') or fallback}"
    if plan.action_type == "open_folder":
        return f"Open {plan.params.get('label') or plan.params.get('folder') or fallback}"
    if plan.action_type == "open_file":
        return f"Open {plan.params.get('query') or fallback}"
    if plan.action_type == "close_process":
        return f"Close {plan.params.get('displayName') or plan.params.get('target') or fallback}"
    return fallback
