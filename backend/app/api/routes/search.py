from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.api.schemas import SemanticSearchRequest
from backend.app.core.config import settings
from backend.app.database.session import SessionLocal, get_db
from backend.app.services.async_runner import run_cpu_bound
from backend.app.services.search_service import EmbeddingStatsService, SearchService

router = APIRouter(prefix="/search", tags=["search"])


@router.post("/semantic")
async def semantic_search(payload: SemanticSearchRequest, db: Session = Depends(get_db)) -> dict:
    del db  # use a thread-local session — SQLAlchemy sessions are not thread-safe

    def _run() -> dict:
        thread_db = SessionLocal()
        try:
            return SearchService(thread_db).semantic_search(
                payload.query,
                payload.page,
                payload.pageSize,
                payload.folderId,
                payload.extension,
            )
        finally:
            thread_db.close()

    try:
        return await run_cpu_bound(_run, timeout_seconds=90.0)
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Semantic search failed: {exc}") from exc


@router.get("/stats")
def search_stats() -> dict:
    return SearchService.search_stats()
