from fastapi import APIRouter
from sqlalchemy import text

from backend.app.core.config import settings
from backend.app.database.session import engine

from backend.app.services.chroma_store import get_chroma_store

router = APIRouter(tags=["health"])


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
        get_chroma_store().count()
    except Exception:
        chroma_status = "error"

    return {
        "status": "ok" if db_status == "ok" and chroma_status == "ok" else "degraded",
        "service": settings.app_name,
        "version": settings.app_version,
        "database": db_status,
        "chroma": chroma_status,
    }
