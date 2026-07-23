from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.database.session import get_db
from backend.app.services.chroma_store import get_chroma_store
from backend.app.services.embedding_service import EmbeddingService
from backend.app.services.embedding_worker import embedding_worker
from backend.app.services.search_service import SearchService

router = APIRouter(prefix="/embeddings", tags=["embeddings"])


@router.get("/status")
def embedding_status(db: Session = Depends(get_db)) -> dict:
    stats = EmbeddingService(db).stats()
    try:
        chroma_count = get_chroma_store().count()
        chroma_ok = True
    except Exception as exc:
        chroma_count = 0
        chroma_ok = False
        stats["chromaError"] = str(exc)
    return {
        **stats,
        "chromaOk": chroma_ok,
        "chromaPath": settings.orbit_chroma_path,
        "chromaVectors": chroma_count,
        "searchQueries": SearchService.search_stats().get("totalQueries", 0),
    }


@router.post("/rebuild")
def rebuild_embeddings() -> dict:
    embedding_worker.request_rebuild()
    return {"ok": True, "message": "Rebuild queued"}


@router.post("/sync")
def sync_embeddings(db: Session = Depends(get_db)) -> dict:
    embedding_worker.enqueue_backfill()
    return {"ok": True, "message": "Backfill queued"}
