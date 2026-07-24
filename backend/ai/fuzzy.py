from __future__ import annotations

import re
from difflib import get_close_matches

# Abbreviation / typo expansions for document and app-name queries.
_ALIASES: dict[str, str] = {
    "chrom": "chrome",
    "chr": "chrome",
    "chome": "chrome",
    "ppt": "powerpoint",
    "ppoint": "powerpoint",
    "doc": "document",
    "docs": "documents",
    "pdf": "pdf",
    "xls": "excel spreadsheet",
    "xlsx": "excel spreadsheet",
    "txt": "text file",
    "resume": "resume cv",
    "inv": "invoice",
    "ml": "machine learning",
    "ai": "artificial intelligence",
    "db": "database",
    "repo": "repository",
    "readme": "readme documentation",
    "config": "configuration settings",
    "spec": "specification",
    "specs": "specifications",
}

_APP_NAMES = (
    "chrome",
    "firefox",
    "edge",
    "code",
    "vscode",
    "docker",
    "spotify",
    "discord",
    "slack",
    "python",
    "node",
    "ollama",
)

_FILLER_WORDS = frozenset(
    {
        "a",
        "an",
        "the",
        "my",
        "any",
        "some",
        "all",
        "please",
        "show",
        "list",
        "find",
        "search",
        "for",
        "about",
        "related",
        "to",
        "on",
        "in",
        "of",
        "me",
        "do",
        "i",
        "have",
        "are",
        "there",
        "what",
        "which",
        "files",
        "file",
        "documents",
        "document",
        "indexed",
        "mention",
        "mentions",
        "mentioning",
        "contain",
        "contains",
        "containing",
        "include",
        "includes",
        "including",
        "talk",
        "talks",
        "about",
        "discuss",
        "discusses",
        "reference",
        "references",
    }
)

_RAG_PREFIX_PATTERNS: tuple[str, ...] = (
    r"^what documents (?:mention|contain|include|discuss|reference|talk about|about)\s+",
    r"^which (?:files|documents) (?:mention|contain|include|discuss|reference|about)\s+",
    r"^find (?:documents|files) (?:about|mentioning|containing|on|for)\s+",
    r"^search (?:my )?(?:files|documents|indexed files) for\s+",
    r"^show (?:me )?(?:documents|files) (?:about|mentioning|containing)\s+",
    r"^list (?:documents|files) (?:about|mentioning|containing)\s+",
    r"^do (?:i|any of my files) (?:have|contain) (?:anything (?:about|on) )?",
    r"^documents (?:about|mentioning|containing|on)\s+",
    r"^files (?:about|mentioning|containing|on)\s+",
    r"^where (?:is|are) .+ (?:mentioned|discussed|referenced)",
)


def normalize_query_text(message: str) -> str:
    text = message.strip()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"^what's\b", "what is", text, flags=re.IGNORECASE)
    text = re.sub(r"^where's\b", "where is", text, flags=re.IGNORECASE)
    return text.strip(" ?!.")


def extract_rag_query(message: str) -> str:
    """Extract the semantic search topic from a natural-language document question."""
    text = normalize_query_text(message)
    lower = text.lower()

    for pattern in _RAG_PREFIX_PATTERNS:
        stripped = re.sub(pattern, "", lower, flags=re.IGNORECASE).strip(" ?!.")
        if stripped and stripped != lower:
            text = stripped
            lower = stripped.lower()
            break

    # "notes about machine learning" → "machine learning"
    about_match = re.search(r"^(?:.+? )about (.+)$", lower)
    if about_match and len(about_match.group(1).split()) <= 8:
        text = about_match.group(1).strip(" ?!.")

    return expand_search_query(text)


def _expand_tokens(text: str) -> list[str]:
    lower = text.lower()
    parts: list[str] = [text]

    for token, expansion in _ALIASES.items():
        if re.search(rf"\b{re.escape(token)}\b", lower):
            parts.append(expansion)

    tokens = re.findall(r"[a-z0-9]+", lower)
    for app in _APP_NAMES:
        if app in lower or get_close_matches(app, tokens, n=1, cutoff=0.82):
            parts.append(app)

    seen: set[str] = set()
    merged: list[str] = []
    for part in parts:
        key = part.lower()
        if key not in seen:
            seen.add(key)
            merged.append(part)
    return merged


def expand_search_query(message: str) -> str:
    """Expand abbreviations and partial tokens to improve semantic retrieval."""
    text = normalize_query_text(message)
    if not text:
        return text
    return " ".join(_expand_tokens(text))


def keyword_fallback_terms(message: str) -> list[str]:
    """Return salient keywords for lexical fallback when embeddings are weak."""
    text = extract_rag_query(message).lower()
    tokens = [t for t in re.findall(r"[a-z0-9]{3,}", text) if t not in _FILLER_WORDS]
    expanded: list[str] = []
    for token in tokens:
        expanded.append(token)
        if token in _ALIASES:
            expanded.extend(_ALIASES[token].split())
    deduped: list[str] = []
    seen: set[str] = set()
    for token in expanded:
        if token not in seen:
            seen.add(token)
            deduped.append(token)
    return deduped[:6]
