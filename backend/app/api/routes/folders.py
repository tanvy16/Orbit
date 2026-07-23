from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.api.schemas import WatchedFolderCreate, WatchedFolderUpdate
from backend.app.database.session import get_db
from backend.app.services.folder_service import FolderService

router = APIRouter(prefix="/folders", tags=["folders"])


def _serialize_folder(folder, file_count: int) -> dict:
    return {
        "id": folder.id,
        "path": folder.path,
        "label": folder.label,
        "enabled": folder.enabled,
        "lastScanAt": folder.last_scan_at.isoformat() if folder.last_scan_at else None,
        "indexedFileCount": file_count,
        "createdAt": folder.created_at.isoformat()
        if isinstance(folder.created_at, datetime)
        else str(folder.created_at),
    }


@router.get("")
def list_folders(db: Session = Depends(get_db)) -> list[dict]:
    service = FolderService(db)
    counts = service.folder_file_counts()
    return [_serialize_folder(f, counts.get(f.id, 0)) for f in service.list_folders()]


@router.post("")
def create_folder(payload: WatchedFolderCreate, db: Session = Depends(get_db)) -> dict:
    service = FolderService(db)
    folder = service.create_folder(payload.path, payload.label, payload.enabled)
    counts = service.folder_file_counts()
    return _serialize_folder(folder, counts.get(folder.id, 0))


@router.patch("/{folder_id}")
def update_folder(
    folder_id: int, payload: WatchedFolderUpdate, db: Session = Depends(get_db)
) -> dict:
    service = FolderService(db)
    try:
        folder = service.update_folder(folder_id, payload.label, payload.enabled)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    counts = service.folder_file_counts()
    return _serialize_folder(folder, counts.get(folder.id, 0))


@router.delete("/{folder_id}")
def delete_folder(folder_id: int, db: Session = Depends(get_db)) -> dict:
    service = FolderService(db)
    try:
        service.delete_folder(folder_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"ok": True}
