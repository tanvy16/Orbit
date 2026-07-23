from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.database.session import get_db
from backend.app.services.embedding_worker import embedding_worker
from backend.app.services.search_service import EmbeddingStatsService, SearchService

router = APIRouter(prefix="/embeddings", tags=["embeddings"])


@router.get("/status")
def embedding_status(db: Session = Depends(get_db)) -> dict:
    metrics = EmbeddingStatsService(db).compute()
    return {
        **metrics,
        "chromaPath": settings.orbit_chroma_path,
        "searchQueries": SearchService.search_stats().get("totalQueries", 0),
        # Backward-compatible aliases for existing UI fields
        "totalEmbeddings": metrics["vectorChunks"],
    }


@router.post("/rebuild")
def rebuild_embeddings() -> dict:
    embedding_worker.request_rebuild()
    return {"ok": True, "message": "Rebuild queued"}


@router.post("/sync")
def sync_embeddings() -> dict:
    embedding_worker.enqueue_backfill()
    return {"ok": True, "message": "Backfill queued"}
