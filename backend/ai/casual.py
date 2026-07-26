from __future__ import annotations

import re
from typing import Any

from backend.ai.intent import _CASUAL_EXACT


_CASUAL_REPLIES: dict[str, str] = {
    "hi": "Hello! I'm Orbit, your desktop intelligence assistant. Ask me about your system, files, or automations.",
    "hello": "Hello! How can I help you today?",
    "hey": "Hey! I'm ready when you are — system stats, document search, or desktop actions.",
    "thanks": "You're welcome! Let me know if you need anything else.",
    "thank you": "You're welcome! Happy to help anytime.",
    "good morning": "Good morning! Orbit is online and monitoring your desktop.",
    "good afternoon": "Good afternoon! What would you like to explore?",
    "good evening": "Good evening! I'm here if you need system insights or automation.",
    "how are you": "I'm running smoothly and ready to help. What can I do for you?",
    "what can you do": (
        "I can monitor CPU, memory, and disk; search your indexed documents; "
        "run desktop automations; and answer questions about your system — all from one place."
    ),
}


def try_casual_response(message: str) -> dict[str, Any] | None:
    """Instant replies for simple greetings — no LLM round-trip."""
    text = message.strip()
    if not text or len(text) > 80:
        return None
    normalized = re.sub(r"[!?.]+$", "", text.lower())
    if normalized not in _CASUAL_EXACT and not any(
        normalized.startswith(f"{phrase} ") for phrase in _CASUAL_EXACT
    ):
        return None

    reply = _CASUAL_REPLIES.get(normalized)
    if not reply:
        for phrase in _CASUAL_EXACT:
            if normalized.startswith(f"{phrase} "):
                reply = _CASUAL_REPLIES.get(phrase)
                break
    if not reply:
        reply = "Hello! I'm Orbit — ask me about your system, documents, or automations."

    return {
        "reply": reply,
        "directAnswer": True,
        "systemContext": {},
        "healthSummary": {
            "score": 0,
            "performance": "Unknown",
            "detectedIssues": [],
            "recommendations": [],
        },
        "documentSources": [],
        "analysis": {},
        "profile": {"casualFastPath": 0},
    }
