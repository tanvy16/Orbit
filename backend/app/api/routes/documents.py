from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.api.schemas import (
    IndexedFileBatchUpsert,
    MaintenanceRequest,
    NotificationCreate,
    SettingsUpdate,
    TaskCreate,
    TaskUpdate,
    WatchedFolderCreate,
    WatchedFolderUpdate,
)
from backend.app.database.session import get_db
from backend.app.models.entities import IndexedFile, WatchedFolder
from backend.app.services.document_service import DocumentService
from backend.app.services.folder_service import FolderService
from backend.app.services.notification_service import NotificationService
from backend.app.services.settings_service import SettingsService
from backend.app.services.task_service import TaskService

router = APIRouter(prefix="/documents", tags=["documents"])


def _serialize_document(row: IndexedFile, folder_path: str | None) -> dict:
    try:
        metadata = json.loads(row.metadata_json or "{}")
    except json.JSONDecodeError:
        metadata = {}
    return {
        "id": row.id,
        "path": row.path,
        "fileName": row.file_name,
        "extension": row.extension,
        "sizeBytes": row.size_bytes,
        "modifiedAt": row.modified_at,
        "contentHash": row.content_hash,
        "mimeType": row.mime_type,
        "indexStatus": row.index_status,
        "watchedFolderId": row.watched_folder_id,
        "watchedFolderPath": folder_path,
        "isDuplicate": row.duplicate_of_id is not None,
        "metadata": metadata,
        "createdAt": row.created_at.isoformat() if isinstance(row.created_at, datetime) else str(row.created_at),
        "updatedAt": row.updated_at.isoformat() if isinstance(row.updated_at, datetime) else str(row.updated_at),
    }


@router.get("")
def list_documents(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    sortBy: str = Query("updatedAt"),
    sortDir: str = Query("desc"),
    extension: str | None = None,
    folderId: int | None = None,
    search: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
) -> dict:
    service = DocumentService(db)
    folder_service = FolderService(db)
    folders = {f.id: f.path for f in folder_service.list_folders()}
    items, total = service.list_documents(
        page, pageSize, sortBy, sortDir, extension, folderId, search, status
    )
    total_pages = max(1, (total + pageSize - 1) // pageSize)
    return {
        "items": [_serialize_document(row, folders.get(row.watched_folder_id)) for row in items],
        "page": page,
        "pageSize": pageSize,
        "total": total,
        "totalPages": total_pages,
    }


@router.get("/stats")
def document_stats(db: Session = Depends(get_db)) -> dict:
    return DocumentService(db).stats()


@router.get("/folders/{folder_id}/fingerprints")
def folder_fingerprints(folder_id: int, db: Session = Depends(get_db)) -> dict[str, dict]:
    rows = db.scalars(
        select(IndexedFile).where(
            IndexedFile.watched_folder_id == folder_id,
            IndexedFile.index_status != "removed",
        )
    ).all()
    return {
        row.path: {
            "sizeBytes": row.size_bytes,
            "modifiedAt": row.modified_at,
            "contentHash": row.content_hash,
        }
        for row in rows
    }


@router.post("/batch")
def upsert_documents(payload: IndexedFileBatchUpsert, db: Session = Depends(get_db)) -> dict:
    return DocumentService(db).upsert_batch(payload)


@router.post("/folders/{folder_id}/scanned")
def mark_folder_scanned(folder_id: int, db: Session = Depends(get_db)) -> dict:
    DocumentService(db).mark_folder_scanned(folder_id)
    return {"ok": True}
