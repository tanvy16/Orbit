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
