from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from backend.observability.diagnostics_store import record_copilot_profile
from backend.observability.event_logger import EventLogger


def record_copilot_outcome(
    db: Session,
    *,
    message: str,
    response: dict[str, Any],
    route: str,
) -> None:
    profile = response.get("profile") if isinstance(response.get("profile"), dict) else {}
    model = response.get("modelUsed")
    direct = bool(response.get("directAnswer"))
    desktop_result = response.get("desktopActionResult")
    verified = None
    if isinstance(desktop_result, dict):
        verified = desktop_result.get("verified")
    intents = response.get("intents")
    intent_str = ",".join(str(item) for item in intents) if isinstance(intents, list) else None
    duration_ms = profile.get("totalMs") if profile else None
    reply = str(response.get("reply") or "")
    status = "success" if reply.strip() or response.get("desktopAction") else "failure"

    record_copilot_profile(
        message=message,
        model=model,
        profile=profile,
        route=route,
        direct_answer=direct,
    )
    EventLogger(db).record(
        category="ai",
        action="copilot_chat",
        status=status,
        user_command=message,
        intent=intent_str,
        model=model,
        route=route,
        duration_ms=float(duration_ms) if duration_ms is not None else None,
        verified=verified if isinstance(verified, bool) else None,
        metadata={
            "directAnswer": direct,
            "desktopAction": bool(response.get("desktopAction")),
            "profile": profile,
        },
    )
