from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.api.schemas import SemanticSearchRequest
from backend.app.database.session import get_db
from backend.app.services.search_service import SearchService

router = APIRouter(prefix="/search", tags=["search"])


@router.post("/semantic")
def semantic_search(payload: SemanticSearchRequest, db: Session = Depends(get_db)) -> dict:
    return SearchService(db).semantic_search(
        payload.query,
        payload.page,
        payload.pageSize,
        payload.folderId,
        payload.extension,
    )


@router.get("/stats")
def search_stats(db: Session = Depends(get_db)) -> dict:
    return SearchService.search_stats()
