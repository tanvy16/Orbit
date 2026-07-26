from fastapi import APIRouter
from sqlalchemy import text

from backend.app.core.config import settings
from backend.app.database.session import engine
from backend.app.services.chroma_store import get_chroma_store
from backend.app.services.desktop_bridge import bridge_health
from backend.app.services.settings_service import SettingsService

router = APIRouter(tags=["health"])


def _ollama_status() -> dict[str, str]:
    from backend.app.database.session import SessionLocal
    from backend.app.services.ollama_client import DEFAULT_OLLAMA_BASE_URL, OllamaError, list_models

    db = SessionLocal()
    try:
        app_settings = SettingsService(db).get_settings()
        base = (app_settings.get("ollamaBaseUrl") or DEFAULT_OLLAMA_BASE_URL).strip()
        provider = app_settings.get("copilotProvider", "ollama")
        if provider != "ollama":
            return {"status": "ready", "provider": provider, "detail": "External AI provider configured"}
        list_models(base)
        return {"status": "ready", "provider": "ollama", "detail": base}
    except OllamaError as exc:
        return {"status": "error", "provider": "ollama", "detail": str(exc)}
    except Exception as exc:
        return {"status": "error", "provider": "ollama", "detail": str(exc)}
    finally:
        db.close()


@router.get("/health")
def health_check() -> dict[str, str]:
    db_status = "ok"
    chroma_status = "ok"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"
    try:
        get_chroma_store().ping()
    except Exception:
        chroma_status = "error"

    return {
        "status": "ok" if db_status == "ok" and chroma_status == "ok" else "degraded",
        "service": settings.app_name,
        "version": settings.app_version,
        "database": db_status,
        "chroma": chroma_status,
    }


@router.get("/health/startup")
def startup_status() -> dict:
    """Live initialization status for the dashboard widget — no fake readiness."""
    db_status = "pending"
    chroma_status = "pending"
    semantic_status = "pending"

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = "ready"
    except Exception as exc:
        db_status = "error"
        db_error = str(exc)
    else:
        db_error = None

    try:
        store = get_chroma_store()
        store.ping()
        chroma_status = "ready"
        semantic_status = "ready" if store.count() >= 0 else "pending"
    except Exception as exc:
        chroma_status = "error"
        semantic_status = "error"
        chroma_error = str(exc)
    else:
        chroma_error = None

    bridge = bridge_health()
    bridge_status = "ready" if bridge.get("ok") else "error"

    ollama = _ollama_status()
    ai_status = "ready" if ollama.get("status") == "ready" else "error"

    backend_status = "ready" if db_status == "ready" else "error"
    automation_status = "ready" if backend_status == "ready" else "pending"

    return {
        "backend": backend_status,
        "database": db_status,
        "chroma": chroma_status,
        "semanticSearch": semantic_status,
        "aiModels": ai_status,
        "aiDetail": ollama.get("detail"),
        "desktopBridge": bridge_status,
        "automation": automation_status,
        "errors": {
            "database": db_error,
            "chroma": chroma_error,
            "ai": None if ai_status == "ready" else ollama.get("detail"),
            "desktopBridge": bridge.get("error"),
        },
    }
