from __future__ import annotations

import httpx

from backend.app.core.ai_config import DEFAULT_OLLAMA_BASE_URL, OLLAMA_TAGS_TIMEOUT_SECONDS
from backend.app.core.logging import logger

_OLLAMA_CLIENTS: dict[str, httpx.Client] = {}


class OllamaError(Exception):
    """Raised when Ollama is unreachable or returns an invalid response."""


def _client(base_url: str) -> httpx.Client:
    key = base_url.rstrip("/")
    client = _OLLAMA_CLIENTS.get(key)
    if client is None:
        client = httpx.Client(timeout=OLLAMA_TAGS_TIMEOUT_SECONDS)
        _OLLAMA_CLIENTS[key] = client
    return client


def list_models(base_url: str) -> list[dict]:
    """Fetch installed models from Ollama ``GET /api/tags``."""
    url = f"{base_url.rstrip('/')}/api/tags"
    try:
        response = _client(base_url).get(url)
        response.raise_for_status()
        payload = response.json()
    except httpx.HTTPError as exc:
        logger.warning("Ollama model list failed for %s: %s", base_url, exc)
        raise OllamaError(f"Cannot reach Ollama at {base_url}. Is it running?") from exc

    models: list[dict] = []
    for item in payload.get("models") or []:
        name = str(item.get("name") or item.get("model") or "").strip()
        if not name:
            continue
        models.append(
            {
                "name": name,
                "sizeBytes": int(item.get("size") or 0),
                "modifiedAt": item.get("modified_at"),
                "digest": item.get("digest"),
            }
        )

    models.sort(key=lambda row: row["name"].lower())
    return models
