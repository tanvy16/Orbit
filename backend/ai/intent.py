from __future__ import annotations

import re

from backend.ai.direct import classify_hybrid_route
from backend.ai.query_patterns import is_document_search_query, needs_generation, needs_reasoning

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
        "mention",
        "mentions",
        "mentioning",
        "containing",
        "contains",
        "about",
        "topic",
        "subject",
        "machine learning",
        "research",
        "paper",
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
    "what documents",
    "which files",
    "which documents",
    "documents about",
    "files about",
    "documents mention",
    "files mention",
    "search for",
    "search my files",
    "search my documents",
)

_SYSTEM_MARKERS: tuple[str, ...] = (
    "duplicate file",
    "duplicate files",
    "find duplicates",
    "list duplicate",
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

_GENERATION_MARKERS: tuple[str, ...] = (
    "summarize",
    "summarise",
    "explain",
    "analyze",
    "analyse",
    "recommend",
    "compare",
    "rewrite",
    "draft",
    "write",
    "generate",
)


def should_use_rag(message: str) -> bool:
    text = message.strip().lower()
    if not text:
        return False

    if is_document_search_query(text):
        return False

    if any(marker in text for marker in _FILE_MARKERS):
        return True

    if any(marker in text for marker in _SYSTEM_MARKERS):
        return False

    if re.search(r"\b(cpu|ram|memory|battery|disk|storage|gpu|process(es)?)\b", text):
        if not any(kw in text for kw in ("document", "file", "pdf", "report", "invoice", "notes", "mention")):
            return False

    return any(keyword in text for keyword in _DOCUMENT_KEYWORDS)


def needs_llm(message: str) -> bool:
    """True when natural-language generation or reasoning is required."""
    route = classify_hybrid_route(message)
    if route:
        return False

    text = message.strip().lower()
    if _is_casual(text):
        return True

    if needs_generation(text) or needs_reasoning(text):
        return True

    if should_use_rag(text):
        return True

    if any(marker in text for marker in _SYSTEM_MARKERS):
        return True

    if re.search(r"\b(cpu|ram|memory|battery|disk|storage|gpu|slow|performance)\b", text):
        return True

    return True


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


def classify_intents(message: str) -> dict[str, bool | str | None]:
    text = message.strip().lower()
    route = classify_hybrid_route(message)
    if route:
        query_type = route["type"]
        return {
            "direct_answer": True,
            "direct_query": query_type,
            "needs_llm": False,
            "casual": False,
            "general": False,
            "rag": query_type == "document_search",
            "duplicates": query_type == "duplicates_list",
            "duplicates_semantic": bool((route.get("params") or {}).get("include_semantic")),
            "storage_health": False,
            "health_report": False,
            "telemetry": query_type in {"cpu", "ram", "disk", "gpu", "battery", "network", "processes", "process_count", "system_health"},
            "processes": query_type in {"processes", "process_count"},
            "indexing": query_type in {"indexed_documents", "embeddings", "vector_chunks", "chroma_status"},
            "recommendations": False,
        }

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
    ) and any(marker in text for marker in _GENERATION_MARKERS)
    processes = not casual and bool(
        any(marker in text for marker in _PROCESS_MARKERS)
        or (
            re.search(r"\b(using|consumer|hog)\b", text)
            and re.search(r"\b(ram|memory)\b", text)
        )
    )
    telemetry = not casual and (
        processes
        or health_report
        or storage_health
        or duplicates
        or any(marker in text for marker in _SYSTEM_MARKERS)
        or bool(re.search(r"\b(cpu|ram|memory|battery|disk|storage|gpu|slow|performance)\b", text))
    )
    indexing = not casual and (
        rag
        or any(marker in text for marker in _INDEXING_MARKERS)
        or re.search(r"\bindex(ing|ed)\b", text) is not None
    )
    recommendations = not casual and (
        health_report
        or storage_health
        or duplicates
        or "recommend" in text
        or "recommendation" in text
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
        "direct_answer": False,
        "direct_query": None,
        "needs_llm": needs_llm(message),
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
