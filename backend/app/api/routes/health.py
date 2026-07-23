from fastapi import APIRouter
from sqlalchemy import text

from backend.app.core.config import settings
from backend.app.database.session import engine

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check() -> dict[str, str]:
    db_status = "ok"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"

    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "database": db_status,
    }
