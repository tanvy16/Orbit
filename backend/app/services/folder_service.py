from __future__ import annotations

from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models.entities import WatchedFolder


class FolderService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_folders(self) -> list[WatchedFolder]:
        return list(self.db.scalars(select(WatchedFolder).order_by(WatchedFolder.path)).all())

    def get_folder(self, folder_id: int) -> WatchedFolder | None:
        return self.db.get(WatchedFolder, folder_id)

    def create_folder(self, path: str, label: str | None, enabled: bool) -> WatchedFolder:
        normalized = str(Path(path).resolve())
        existing = self.db.scalar(select(WatchedFolder).where(WatchedFolder.path == normalized))
        if existing:
            return existing
        folder = WatchedFolder(
            path=normalized,
            label=label or Path(normalized).name,
            enabled=enabled,
        )
        self.db.add(folder)
        self.db.commit()
        self.db.refresh(folder)
        return folder

    def update_folder(
        self, folder_id: int, label: str | None, enabled: bool | None
    ) -> WatchedFolder:
        folder = self.db.get(WatchedFolder, folder_id)
        if not folder:
            raise ValueError("Folder not found")
        if label is not None:
            folder.label = label
        if enabled is not None:
            folder.enabled = enabled
        self.db.commit()
        self.db.refresh(folder)
        return folder

    def delete_folder(self, folder_id: int) -> None:
        folder = self.db.get(WatchedFolder, folder_id)
        if not folder:
            raise ValueError("Folder not found")
        self.db.delete(folder)
        self.db.commit()

    def folder_file_counts(self) -> dict[int, int]:
        from sqlalchemy import func

        from backend.app.models.entities import IndexedFile

        rows = self.db.execute(
            select(IndexedFile.watched_folder_id, func.count())
            .where(IndexedFile.index_status != "removed")
            .group_by(IndexedFile.watched_folder_id)
        ).all()
        return {fid: count for fid, count in rows if fid is not None}
