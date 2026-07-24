from __future__ import annotations

import re

# Document-oriented vocabulary (substring match on lowercased message).
_DOCUMENT_KEYWORDS: frozenset[str] = frozenset(
    {
        "document",
        "file",
        "pdf",
        "search",
        "report",
        "notes",
        "manual",
        "read",
        "summarize",
        "resume",
        "invoice",
        "contract",
        "presentation",
        "slides",
        "spreadsheet",
        "docx",
        "xlsx",
        "indexed",
        "knowledge base",
        "documentation",
    }
)

_FILE_MARKERS: tuple[str, ...] = (
    ".pdf",
    ".docx",
    ".txt",
    ".md",
    ".xlsx",
    "indexed file",
    "indexed files",
    "my files",
    "search my",
    "find invoice",
    "project documentation",
    "my report",
    "the report",
    "notes.pdf",
    "what does ",
    " contain",
)

_SYSTEM_MARKERS: tuple[str, ...] = (
    "duplicate file",
    "duplicate files",
    "find duplicates",
    "near duplicate",
    "ssd health",
    "smart data",
    "bad sector",
    "storage health",
    "analyze my computer",
    "analyze my pc",
    "recommend",
    "recommendation",
    "today's desktop",
    "desktop activity",
    "indexed folder",
    "indexing status",
    "system health",
    "health report",
    "system status",
    "summarize current system",
    "current system status",
    "laptop slow",
    "computer slow",
    "why is my laptop",
    "why is my computer",
    "why is my pc",
    "using my ram",
    "what is using my ram",
    "most cpu",
    "which process",
    "process uses",
    "how much battery",
    "battery left",
    "storage usage",
    "current storage",
    "show storage",
    "disk usage",
    "disk space",
    "free space",
    "gpu usage",
    "network activity",
    "network speed",
    "running process",
    "performance issue",
    "analyze my system",
    "desktop intelligence",
    "telemetry",
)

_CASUAL_EXACT: frozenset[str] = frozenset(
    {
        "hi",
        "hello",
        "hey",
        "thanks",
        "thank you",
        "good morning",
        "good evening",
        "good afternoon",
        "how are you",
        "what can you do",
    }
)

_PROCESS_MARKERS: tuple[str, ...] = (
    "process",
    "processes",
    "using my ram",
    "what is using",
    "most cpu",
    "which app",
    "running app",
    "top cpu",
    "top ram",
    "memory hog",
)

_INDEXING_MARKERS: tuple[str, ...] = (
    "indexing",
    "indexed folder",
    "embedding",
    "embeddings",
    "vector",
    "index status",
    "indexed documents",
    "knowledge base",
)


def should_use_rag(message: str) -> bool:
    text = message.strip().lower()
    if not text:
        return False

    if any(marker in text for marker in _FILE_MARKERS):
        return True

    if any(marker in text for marker in _SYSTEM_MARKERS):
        return False

    if re.search(r"\b(cpu|ram|memory|battery|disk|storage|gpu|process(es)?)\b", text):
        if not any(kw in text for kw in ("document", "file", "pdf", "report", "invoice", "notes")):
            return False

    return any(keyword in text for keyword in _DOCUMENT_KEYWORDS)


def _is_casual(text: str) -> bool:
    if len(text) > 80:
        return False
    if any(marker in text for marker in _SYSTEM_MARKERS):
        return False
    if should_use_rag(text):
        return False
    normalized = re.sub(r"[!?.]+$", "", text.strip().lower())
    if normalized in _CASUAL_EXACT:
        return True
    return any(normalized.startswith(f"{phrase} ") for phrase in _CASUAL_EXACT)


def classify_intents(message: str) -> dict[str, bool]:
    text = message.strip().lower()
    casual = _is_casual(text)
    rag = False if casual else should_use_rag(message)
    duplicates = any(
        phrase in text for phrase in ("duplicate", "duplicates", "same file", "copy of")
    )
    duplicates_semantic = any(
        phrase in text
        for phrase in ("near duplicate", "similar file", "similar files", "semantic duplicate")
    )
    storage_health = any(
        phrase in text
        for phrase in ("ssd", "smart", "bad sector", "storage health", "disk health", "drive health")
    )
    health_report = any(
        phrase in text
        for phrase in (
            "health report",
            "analyze my computer",
            "analyze my pc",
            "analyze my system",
            "system health",
            "how is my computer",
        )
    )
    telemetry = not casual and (
        health_report
        or storage_health
        or duplicates
        or any(marker in text for marker in _SYSTEM_MARKERS)
        or bool(re.search(r"\b(cpu|ram|memory|battery|disk|storage|gpu|slow|performance)\b", text))
    )
    processes = not casual and (
        duplicates
        or health_report
        or any(marker in text for marker in _PROCESS_MARKERS)
        or bool(re.search(r"\b(process|processes|slow|ram|memory|cpu)\b", text))
    )
    indexing = not casual and (
        rag
        or any(marker in text for marker in _INDEXING_MARKERS)
        or "index" in text
    )
    recommendations = not casual and (
        telemetry or health_report or storage_health or duplicates or indexing
    )

    general = (
        not casual
        and not rag
        and not duplicates
        and not storage_health
        and not health_report
        and not telemetry
    )

    return {
        "casual": casual,
        "general": general,
        "rag": rag,
        "duplicates": duplicates,
        "duplicates_semantic": duplicates_semantic,
        "storage_health": storage_health,
        "health_report": health_report,
        "telemetry": telemetry,
        "processes": processes,
        "indexing": indexing,
        "recommendations": recommendations,
    }
