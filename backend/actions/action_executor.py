from __future__ import annotations

import json
import time
from typing import Any

from sqlalchemy.orm import Session

from backend.actions.classifier import action_reply_prefix, classify_desktop_action
from backend.actions.file_actions import enrich_action_plan, format_candidates_reply
from backend.actions.types import ActionPlan
from backend.ai.perf import PipelineTimer
from backend.app.core.logging import logger
from backend.app.services.desktop_bridge import DesktopBridgeError, execute_desktop_plan
from backend.app.services.llm_providers import DEFAULT_COPILOT_MODEL, get_llm_provider
from backend.app.services.settings_service import SettingsService
from backend.history.logger import ActionHistoryLogger

_CLIPBOARD_PROMPTS = {
    "explain": "Explain the following clipboard text clearly and concisely:\n\n{content}",
    "summarize": "Summarize the following clipboard text in a few bullet points:\n\n{content}",
    "translate": "Translate the following clipboard text to English (if already English, polish it):\n\n{content}",
    "improve": "Improve the writing quality of the following clipboard text while preserving meaning:\n\n{content}",
}


def try_action_response(db: Session, message: str) -> dict | None:
    """Build and optionally execute a copilot desktop action response."""
    timer = PipelineTimer(label=f"action:{message[:32]}")
    plan = classify_desktop_action(message)
    timer.mark("classify")
    if not plan:
        return None

    plan = enrich_action_plan(db, plan)
    timer.mark("resolve")

    return build_action_copilot_response(
        db,
        message,
        plan,
        timer=timer,
        execute=not _requires_user_input(plan),
    )


def execute_action_plan(
    db: Session,
    plan: ActionPlan,
    *,
    user_command: str = "",
    force: bool = False,
) -> dict[str, Any]:
    """Execute a desktop action plan and return the Electron result."""
    if _requires_user_input(plan) and not force:
        raise ValueError("This action requires user confirmation or file selection.")

    started = time.perf_counter()
    plan_dict = plan.to_dict()

    try:
        if plan.action_type == "clipboard_intelligence":
            bridge_result = execute_desktop_plan(plan_dict)
            if not bridge_result.get("ok"):
                raise DesktopBridgeError(str(bridge_result.get("message") or "Clipboard read failed"))
            text = str((bridge_result.get("data") or {}).get("text") or "").strip()
            if not text:
                raise DesktopBridgeError("Clipboard is empty or does not contain text.")
            operation = str(plan.params.get("operation") or "explain")
            reply = _process_clipboard_text(db, operation, text)
            result = {
                "ok": True,
                "message": "Clipboard processed successfully.",
                "data": {"reply": reply},
                "executionTimeMs": (time.perf_counter() - started) * 1000,
            }
        else:
            result = execute_desktop_plan(plan_dict)
    except DesktopBridgeError:
        raise
    except Exception as exc:
        raise DesktopBridgeError(str(exc)) from exc

    elapsed_ms = float(result.get("executionTimeMs") or (time.perf_counter() - started) * 1000)
    status = "success" if result.get("ok") else "failed"
    try:
        ActionHistoryLogger(db).record_execution(
            action_id=plan.action_id,
            execution_status=status,
            execution_time_ms=elapsed_ms,
            error_message=None if result.get("ok") else str(result.get("message") or "Execution failed"),
        )
    except Exception:
        logger.exception("Failed to record action execution for %s", plan.action_id)

    try:
        from backend.observability.event_logger import EventLogger

        EventLogger(db).record(
            category="desktop",
            action=plan.action_type,
            status=status,
            user_command=user_command or plan.log_message,
            route="desktop_bridge",
            duration_ms=elapsed_ms,
            verified=bool(result.get("verified")) if result.get("verified") is not None else result.get("ok"),
            error_message=None if result.get("ok") else str(result.get("message") or ""),
            metadata={"actionId": plan.action_id, "details": result.get("details")},
        )
    except Exception:
        logger.exception("Failed to write desktop event log for %s", plan.action_id)

    return result


def build_action_copilot_response(
    db: Session,
    message: str,
    plan: ActionPlan,
    *,
    timer: PipelineTimer | None = None,
    execute: bool = False,
) -> dict[str, Any]:
    settings_data = SettingsService(db).get_settings()
    model_used = settings_data.get("copilotModel", DEFAULT_COPILOT_MODEL)

    try:
        ActionHistoryLogger(db).record_planned(user_command=message, plan=plan, source="copilot")
    except Exception:
        logger.exception("Failed to record action history for plan %s", plan.action_id)

    execution_result: dict[str, Any] | None = None
    if execute:
        try:
            execution_result = execute_action_plan(db, plan, user_command=message, force=True)
        except DesktopBridgeError as exc:
            execution_result = {"ok": False, "message": str(exc)}
            try:
                ActionHistoryLogger(db).record_execution(
                    action_id=plan.action_id,
                    execution_status="failed",
                    error_message=str(exc),
                )
            except Exception:
                logger.exception("Failed to record failed execution for %s", plan.action_id)

    reply = _build_reply(plan, execution_result)
    profile = timer.finish(extra=f"action={plan.action_type}") if timer else {}

    log_line = plan.log_message or plan.action_type
    logger.info("Desktop action %s: %s", "executed" if execution_result else "planned", log_line)

    return {
        "reply": reply,
        "systemContext": {},
        "healthSummary": {},
        "documentSearchUsed": False,
        "documentSources": [],
        "analysis": {},
        "recommendations": [],
        "copilotProvider": settings_data.get("copilotProvider", "ollama"),
        "modelUsed": model_used,
        "directAnswer": True,
        "desktopAction": True,
        "desktopActionPlan": plan.to_dict(),
        "desktopActionResult": execution_result,
        "intents": {
            "direct_answer": True,
            "direct_query": "desktop_action",
            "desktop_action": True,
            "needs_llm": False,
        },
        "profile": profile,
    }


def plan_from_dict(data: dict[str, Any]) -> ActionPlan:
    return ActionPlan(
        action_type=str(data.get("type") or data.get("action_type") or ""),
        params=dict(data.get("params") or {}),
        requires_confirmation=bool(data.get("requiresConfirmation")),
        confirmation_message=data.get("confirmationMessage"),
        status=str(data.get("status") or "pending"),
        log_message=data.get("logMessage"),
        action_id=str(data.get("id") or data.get("action_id") or ""),
    )


def _requires_user_input(plan: ActionPlan) -> bool:
    return plan.requires_confirmation or plan.status == "awaiting_choice"


def _process_clipboard_text(db: Session, operation: str, content: str) -> str:
    settings = SettingsService(db).get_settings()
    provider = get_llm_provider(
        settings.get("copilotProvider", "ollama"),
        settings.get("copilotModel", DEFAULT_COPILOT_MODEL),
        settings.get("ollamaBaseUrl", "http://127.0.0.1:11434"),
    )
    prompt = _CLIPBOARD_PROMPTS.get(operation, _CLIPBOARD_PROMPTS["explain"]).format(content=content)
    return provider.complete("You are Orbit, a helpful desktop assistant.", prompt, history=[]).strip()


def _build_reply(plan: ActionPlan, execution_result: dict[str, Any] | None) -> str:
    if execution_result is not None:
        if plan.action_type == "clipboard_intelligence" and execution_result.get("ok"):
            reply = str((execution_result.get("data") or {}).get("reply") or "")
            if reply:
                return reply
        return _format_execution_reply(plan, execution_result)

    if plan.status == "awaiting_choice" and plan.candidates:
        return format_candidates_reply(plan.candidates)

    prefix = action_reply_prefix(plan)
    if plan.requires_confirmation:
        return f"{prefix}\n\nThis action requires your confirmation before it runs."

    if plan.action_type == "clipboard_intelligence":
        operation = plan.params.get("operation", "explain")
        return f"{prefix}\n\nI'll {operation} the text on your clipboard."

    return prefix


def _format_execution_reply(plan: ActionPlan, result: dict[str, Any]) -> str:
    prefix = action_reply_prefix(plan).rstrip("…")
    message = str(result.get("message") or "Unknown result")
    if result.get("ok"):
        return f"{prefix}…\n\n✓ {message}"
    return f"{prefix}…\n\n✗ {message}"
