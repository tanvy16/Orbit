from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.database.session import get_db
from backend.app.services.ollama_client import DEFAULT_OLLAMA_BASE_URL, OllamaError, list_models
from backend.app.services.settings_service import SettingsService

router = APIRouter(prefix="/ollama", tags=["ollama"])


@router.get("/models")
def ollama_models(
    db: Session = Depends(get_db),
    baseUrl: str | None = Query(default=None, max_length=500),
) -> dict:
    settings = SettingsService(db).get_settings()
    resolved_base = (baseUrl or settings.get("ollamaBaseUrl") or DEFAULT_OLLAMA_BASE_URL).strip()

    try:
        models = list_models(resolved_base)
        return {
            "ok": True,
            "baseUrl": resolved_base,
            "models": models,
            "error": None,
        }
    except OllamaError as exc:
        return {
            "ok": False,
            "baseUrl": resolved_base,
            "models": [],
            "error": str(exc),
        }
