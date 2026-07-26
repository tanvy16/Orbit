from __future__ import annotations

import re
from typing import Any

from backend.actions.types import ActionPlan
from backend.ai.query_patterns import (
    is_desktop_action_query,
    is_desktop_app_control,
    is_desktop_clipboard_query,
    is_desktop_file_operation,
    is_desktop_file_search,
    is_desktop_folder_query,
    is_desktop_process_query,
    is_desktop_system_control,
)

_APP_OPEN = re.compile(
    r"^(?:please\s+)?(?:open|launch|start|run)\s+(?:the\s+)?(.+?)(?:\s+app(?:lication)?)?\.?$",
    re.I,
)
_APP_CLOSE = re.compile(
    r"^(?:please\s+)?(?:close|quit|exit|kill|stop)\s+(?:the\s+)?(.+?)(?:\s+app(?:lication)?)?\.?$",
    re.I,
)
_APP_RESTART = re.compile(
    r"^(?:please\s+)?(?:restart|relaunch)\s+(?:the\s+)?(.+?)(?:\s+app(?:lication)?)?\.?$",
    re.I,
)
_FOLDER_OPEN = re.compile(
    r"^(?:please\s+)?(?:open|show|go to)\s+(?:my\s+)?(.+?)(?:\s+folder)?\.?$",
    re.I,
)
_FILE_OPEN = re.compile(
    r"^(?:please\s+)?(?:open|show|view)\s+(?:my\s+|the\s+)?(.+?)(?:\s+file)?\.?$",
    re.I,
)
_FILE_FIND = re.compile(
    r"^(?:please\s+)?(?:find|search(?:\s+for)?|locate|look for)\s+(?:my\s+)?(.+?)\.?$",
    re.I,
)
_CREATE_FOLDER = re.compile(
    r"^(?:please\s+)?create\s+(?:a\s+)?(?:new\s+)?folder(?:\s+(?:named|called)\s+(.+?))?\.?$",
    re.I,
)
_CREATE_TEXT = re.compile(
    r"^(?:please\s+)?create\s+(?:a\s+)?(?:new\s+)?(?:text\s+)?file(?:\s+(?:named|called)\s+(.+?))?\.?$",
    re.I,
)
_RENAME = re.compile(
    r"^(?:please\s+)?rename\s+(?:file|folder)\s+(.+?)\s+to\s+(.+?)\.?$",
    re.I,
)
_MOVE = re.compile(
    r"^(?:please\s+)?move\s+(?:file|folder)\s+(.+?)\s+to\s+(.+?)\.?$",
    re.I,
)
_COPY = re.compile(
    r"^(?:please\s+)?copy\s+(?:file|folder)\s+(.+?)\s+to\s+(.+?)\.?$",
    re.I,
)
_DELETE = re.compile(
    r"^(?:please\s+)?delete\s+(?:file|folder)\s+(.+?)\.?$",
    re.I,
)
_LATEST_FILE = re.compile(
    r"(?:latest|newest|most recent)\s+(pdf|docx?|txt|md|xlsx?|file|document)s?",
    re.I,
)


def classify_desktop_action(message: str) -> ActionPlan | None:
    """Return an action plan when the message is a desktop command."""
    text = message.strip()
    if not text or not is_desktop_action_query(text):
        return None

    lowered = text.lower()

    if is_desktop_clipboard_query(lowered):
        operation = "explain"
        if "summarize" in lowered or "summarise" in lowered:
            operation = "summarize"
        elif "translate" in lowered:
            operation = "translate"
        elif "improve" in lowered or "rewrite" in lowered:
            operation = "improve"
        return ActionPlan(
            action_type="clipboard_intelligence",
            params={"operation": operation},
            log_message=f"clipboard:{operation}",
        )

    if is_desktop_system_control(lowered):
        if "shutdown" in lowered or "shut down" in lowered:
            return ActionPlan(
                action_type="system_shutdown",
                requires_confirmation=True,
                confirmation_message="Shut down your computer now?",
                log_message="system:shutdown",
            )
        if "restart" in lowered and any(w in lowered for w in ("computer", "pc", "system", "machine")):
            return ActionPlan(
                action_type="system_restart",
                requires_confirmation=True,
                confirmation_message="Restart your computer now?",
                log_message="system:restart",
            )

    if is_desktop_process_query(lowered):
        if _APP_RESTART.match(text):
            target = _normalize_target(_APP_RESTART.match(text).group(1))
            return ActionPlan(
                action_type="restart_process",
                params={"target": target},
                log_message=f"process:restart:{target}",
            )
        if _APP_CLOSE.match(text):
            target = _normalize_target(_APP_CLOSE.match(text).group(1))
            return ActionPlan(
                action_type="close_process",
                params={"target": target},
                log_message=f"process:close:{target}",
            )
        if any(
            phrase in lowered
            for phrase in (
                "running applications",
                "running apps",
                "show running",
                "list running",
                "what apps are running",
                "what applications are running",
            )
        ):
            return ActionPlan(
                action_type="list_processes",
                params={"scope": "applications"},
                log_message="process:list",
            )

    if is_desktop_file_operation(lowered):
        match = _DELETE.match(text)
        if match:
            target = match.group(1).strip()
            return ActionPlan(
                action_type="file_delete",
                params={"target": target},
                requires_confirmation=True,
                confirmation_message=f"Delete “{target}”? This cannot be undone.",
                log_message=f"file:delete:{target}",
            )
        match = _RENAME.match(text)
        if match:
            source, dest = match.group(1).strip(), match.group(2).strip()
            return ActionPlan(
                action_type="file_rename",
                params={"source": source, "destination": dest},
                requires_confirmation=True,
                confirmation_message=f"Rename “{source}” to “{dest}”?",
                log_message=f"file:rename:{source}",
            )
        match = _MOVE.match(text)
        if match:
            source, dest = match.group(1).strip(), match.group(2).strip()
            return ActionPlan(
                action_type="file_move",
                params={"source": source, "destination": dest},
                requires_confirmation=True,
                confirmation_message=f"Move “{source}” to “{dest}”?",
                log_message=f"file:move:{source}",
            )
        match = _COPY.match(text)
        if match:
            source, dest = match.group(1).strip(), match.group(2).strip()
            return ActionPlan(
                action_type="file_copy",
                params={"source": source, "destination": dest},
                requires_confirmation=True,
                confirmation_message=f"Copy “{source}” to “{dest}”?",
                log_message=f"file:copy:{source}",
            )
        match = _CREATE_FOLDER.match(text)
        if match:
            name = (match.group(1) or "New Folder").strip()
            return ActionPlan(
                action_type="file_create_folder",
                params={"name": name},
                log_message=f"file:create_folder:{name}",
            )
        match = _CREATE_TEXT.match(text)
        if match:
            name = (match.group(1) or "notes.txt").strip()
            return ActionPlan(
                action_type="file_create_text",
                params={"name": name},
                log_message=f"file:create_text:{name}",
            )

    if is_desktop_file_search(lowered):
        query = _extract_search_query(text)
        extension = _extension_hint(lowered)
        return ActionPlan(
            action_type="file_search",
            params={"query": query, "extension": extension},
            log_message=f"file:search:{query}",
        )

    if is_desktop_folder_query(lowered):
        match = _FOLDER_OPEN.match(text)
        if match:
            folder = _normalize_target(match.group(1))
            return ActionPlan(
                action_type="open_folder",
                params={"folder": folder},
                log_message=f"folder:open:{folder}",
            )

    if is_desktop_app_control(lowered):
        match = _APP_OPEN.match(text)
        if match:
            app_name = _normalize_target(match.group(1))
            return ActionPlan(
                action_type="launch_app",
                params={"app": app_name},
                log_message=f"app:launch:{app_name}",
            )

    if _FILE_OPEN.match(text) and not _looks_like_telemetry(lowered):
        target = _normalize_target(_FILE_OPEN.match(text).group(1))
        if _LATEST_FILE.search(lowered):
            ext_match = _LATEST_FILE.search(lowered)
            extension = None if ext_match.group(1).lower() in {"file", "document"} else ext_match.group(1)
            return ActionPlan(
                action_type="file_search",
                params={"query": "", "extension": extension, "latest": True},
                log_message="file:open:latest",
            )
        return ActionPlan(
            action_type="open_file",
            params={"query": target},
            log_message=f"file:open:{target}",
        )

    return None


def _normalize_target(value: str) -> str:
    cleaned = value.strip().strip('"').strip("'")
    cleaned = re.sub(r"\s+(please|now|for me)$", "", cleaned, flags=re.I)
    return cleaned


def _extract_search_query(text: str) -> str:
    match = _FILE_FIND.match(text.strip())
    if match:
        query = match.group(1).strip()
        query = re.sub(r"\b(from last week|last week|pdf|pdfs|screenshots?|documents?|files?)\b", "", query, flags=re.I)
        return query.strip() or text
    return text


def _extension_hint(text: str) -> str | None:
    if "pdf" in text:
        return ".pdf"
    if "screenshot" in text:
        return ".png"
    if "docx" in text or "word" in text:
        return ".docx"
    if re.search(r"\btxt\b", text):
        return ".txt"
    return None


def _looks_like_telemetry(text: str) -> bool:
    return bool(
        re.search(r"\b(cpu|ram|memory|battery|disk|storage|gpu|telemetry|health)\b", text)
    )


def action_reply_prefix(plan: ActionPlan) -> str:
    """Human-readable in-progress message for the copilot reply."""
    action_type = plan.action_type
    params = plan.params

    if action_type == "launch_app":
        return f"Opening {params.get('app')}…"
    if action_type == "open_folder":
        return f"Opening {params.get('folder')}…"
    if action_type == "open_file":
        return f"Looking for “{params.get('query')}”…"
    if action_type == "file_search":
        if params.get("latest"):
            return "Searching for your latest matching file…"
        return f"Searching for “{params.get('query')}”…"
    if action_type == "close_process":
        return f"Closing {params.get('target')}…"
    if action_type == "restart_process":
        return f"Restarting {params.get('target')}…"
    if action_type == "list_processes":
        return "Fetching running applications…"
    if action_type == "clipboard_intelligence":
        return "Reading your clipboard…"
    if action_type.startswith("file_"):
        return "Preparing file operation…"
    if action_type == "system_shutdown":
        return "Preparing system shutdown…"
    if action_type == "system_restart":
        return "Preparing system restart…"
    return "Executing desktop action…"
