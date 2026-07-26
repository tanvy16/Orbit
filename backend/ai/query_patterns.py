from __future__ import annotations

import re

_REASONING_MARKERS: tuple[str, ...] = (
    "why",
    "explain",
    "analyze",
    "analyse",
    "recommend",
    "summarize",
    "summarise",
    "compare",
    "troubleshoot",
    "help me understand",
    "how can i improve",
    "how do i improve",
    "what should i",
    "diagnose",
    "investigate",
    "interpret",
    "break down",
    "what do you think",
    "give me advice",
    "suggest",
)

_GENERATION_MARKERS: tuple[str, ...] = (
    "summarize",
    "summarise",
    "rewrite",
    "draft",
    "write",
    "compose",
    "generate",
    "create a",
    "in simple terms",
    "explain",
)

_DOCUMENT_SEARCH_PATTERNS: tuple[str, ...] = (
    r"what documents (?:mention|contain|include|discuss|reference|talk about|about)\s+",
    r"which (?:files|documents) (?:mention|contain|include|discuss|reference|about)\s+",
    r"find (?:documents|files) (?:about|mentioning|containing|on|for)\s+",
    r"search (?:my )?(?:files|documents|indexed files) for\s+",
    r"show (?:me )?(?:documents|files) (?:about|mentioning|containing)\s+",
    r"list (?:documents|files) (?:about|mentioning|containing)\s+",
    r"documents (?:about|mentioning|containing|on)\s+",
    r"files (?:about|mentioning|containing|on)\s+",
    r"do (?:i|any of my files) (?:have|contain) (?:anything (?:about|on) )?",
)

_DUPLICATE_LIST_MARKERS: tuple[str, ...] = (
    "duplicate",
    "duplicates",
    "same file",
    "copy of",
    "identical file",
)


def needs_reasoning(text: str) -> bool:
    if any(marker in text for marker in _REASONING_MARKERS):
        return True
    return bool(re.search(r"\bhow can i\b", text) or re.search(r"\bhow do i\b", text))


def needs_generation(text: str) -> bool:
    return any(marker in text for marker in _GENERATION_MARKERS)


def is_document_search_query(text: str) -> bool:
    if needs_generation(text):
        return False
    if needs_reasoning(text) and not re.search(r"\b(mention|contain|about|which|what documents)\b", text):
        return False
    return any(re.search(pattern, text) for pattern in _DOCUMENT_SEARCH_PATTERNS)


def is_duplicate_list_query(text: str) -> bool:
    if not any(marker in text for marker in _DUPLICATE_LIST_MARKERS):
        return False
    if needs_reasoning(text) or needs_generation(text):
        return False
    if any(
        phrase in text
        for phrase in (
            "should i delete",
            "should i remove",
            "what should i do",
            "explain",
            "analyze",
            "analyse",
            "recommend",
        )
    ):
        return False
    return bool(
        re.search(r"\b(list|show|find|any|what are|do i have|give me)\b", text)
        or len(text.split()) <= 6
    )


def is_factual_lookup(text: str) -> bool:
    return bool(
        re.search(
            r"\b(what is|what's|how much|how many|current|show|tell me|list|usage|percent|percentage|level|status|give me)\b",
            text,
        )
        or len(text.split()) <= 7
    )


def is_system_health_lookup(text: str) -> bool:
    if needs_reasoning(text) or needs_generation(text):
        return False
    return bool(
        re.search(
            r"\b(health score|system health score|system health status|current health|health status)\b",
            text,
        )
        and not re.search(r"\b(analy[sz]e|report|recommend)\b", text)
    )


_DESKTOP_APP_MARKERS: tuple[str, ...] = (
    "chrome",
    "google chrome",
    "vs code",
    "visual studio code",
    "cursor",
    "spotify",
    "discord",
    "notepad",
    "file explorer",
)

_DESKTOP_FOLDER_MARKERS: tuple[str, ...] = (
    "downloads",
    "documents",
    "desktop",
    "pictures",
    "photos",
    "music",
    "videos",
)

_DESKTOP_PROCESS_MARKERS: tuple[str, ...] = (
    "close ",
    "quit ",
    "kill ",
    "restart ",
    "relaunch ",
    "running applications",
    "running apps",
    "show running",
    "list running",
)

_DESKTOP_FILE_OP_MARKERS: tuple[str, ...] = (
    "create folder",
    "create a folder",
    "create text file",
    "create a text file",
    "rename file",
    "rename folder",
    "move file",
    "move folder",
    "copy file",
    "copy folder",
    "delete file",
    "delete folder",
)

_DESKTOP_CLIPBOARD_MARKERS: tuple[str, ...] = (
    "clipboard",
    "copied text",
    "copied content",
)

_DESKTOP_SYSTEM_MARKERS: tuple[str, ...] = (
    "shut down",
    "shutdown",
    "restart computer",
    "restart pc",
    "restart system",
    "restart my computer",
)


def is_desktop_app_control(text: str) -> bool:
    lowered = text.strip().lower()
    if not re.match(r"^(?:please\s+)?(?:open|launch|start|run)\b", lowered):
        return False
    if _looks_like_orbit_question(lowered):
        return False
    if any(marker in lowered for marker in _DESKTOP_FOLDER_MARKERS):
        return False
    return any(marker in lowered for marker in _DESKTOP_APP_MARKERS)


def is_desktop_folder_query(text: str) -> bool:
    lowered = text.strip().lower()
    if not re.match(r"^(?:please\s+)?(?:open|show|go to)\b", lowered):
        return False
    if "folder" in lowered or any(marker in lowered for marker in _DESKTOP_FOLDER_MARKERS):
        return not _looks_like_orbit_question(lowered)
    return False


def is_desktop_process_query(text: str) -> bool:
    lowered = text.strip().lower()
    if any(marker in lowered for marker in _DESKTOP_PROCESS_MARKERS):
        return not _looks_like_orbit_question(lowered)
    return False


def is_desktop_file_operation(text: str) -> bool:
    lowered = text.strip().lower()
    return any(marker in lowered for marker in _DESKTOP_FILE_OP_MARKERS)


def is_desktop_clipboard_query(text: str) -> bool:
    lowered = text.strip().lower()
    if not any(marker in lowered for marker in _DESKTOP_CLIPBOARD_MARKERS):
        return False
    return any(
        verb in lowered for verb in ("explain", "summarize", "summarise", "translate", "improve", "rewrite")
    )


def is_desktop_system_control(text: str) -> bool:
    lowered = text.strip().lower()
    return any(marker in lowered for marker in _DESKTOP_SYSTEM_MARKERS)


def is_desktop_file_search(text: str) -> bool:
    lowered = text.strip().lower()
    if is_document_search_query(lowered):
        return False
    if needs_reasoning(lowered) or needs_generation(lowered):
        return False
    if re.match(r"^(?:please\s+)?(?:find|search(?:\s+for)?|locate|look for)\b", lowered):
        if _looks_like_orbit_question(lowered):
            return False
        return True
    if re.search(r"\b(find my|open my|open the latest|latest pdf|latest document)\b", lowered):
        return not _looks_like_orbit_question(lowered)
    return False


def is_desktop_action_query(text: str) -> bool:
    lowered = text.strip().lower()
    if not lowered:
        return False
    if classify_direct_query_exclusion(lowered):
        return False
    return (
        is_desktop_app_control(lowered)
        or is_desktop_folder_query(lowered)
        or is_desktop_process_query(lowered)
        or is_desktop_file_operation(lowered)
        or is_desktop_clipboard_query(lowered)
        or is_desktop_system_control(lowered)
        or is_desktop_file_search(lowered)
        or _is_desktop_open_file(lowered)
    )


def _is_desktop_open_file(text: str) -> bool:
    if not re.match(r"^(?:please\s+)?(?:open|show|view)\b", text):
        return False
    if is_document_search_query(text):
        return False
    if _looks_like_orbit_question(text):
        return False
    if any(marker in text for marker in _DESKTOP_APP_MARKERS + _DESKTOP_FOLDER_MARKERS):
        return False
    return True


def classify_direct_query_exclusion(text: str) -> bool:
    """True when hybrid telemetry/RAG routes should take precedence."""
    if is_duplicate_list_query(text):
        return True
    if is_document_search_query(text):
        return True
    if is_system_health_lookup(text):
        return True
    if is_factual_lookup(text) and re.search(
        r"\b(cpu|ram|memory|battery|disk|storage|gpu|network|process|indexed|embed|chroma|queue|api status)\b",
        text,
    ):
        return True
    return False


def _looks_like_orbit_question(text: str) -> bool:
    return bool(
        re.search(
            r"\b(cpu|ram|memory|battery|disk|storage|gpu|telemetry|health|indexed|embedding|duplicate|orbit)\b",
            text,
        )
    )
