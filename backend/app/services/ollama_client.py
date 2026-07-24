from __future__ import annotations

import httpx

from backend.app.core.logging import logger

DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434"
OLLAMA_TAGS_TIMEOUT_SECONDS = 8.0


class OllamaError(Exception):
    """Raised when Ollama is unreachable or returns an invalid response."""


def list_models(base_url: str) -> list[dict]:
    """Fetch installed models from Ollama ``GET /api/tags``."""
    url = f"{base_url.rstrip('/')}/api/tags"
    try:
        with httpx.Client(timeout=OLLAMA_TAGS_TIMEOUT_SECONDS) as client:
            response = client.get(url)
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
