from __future__ import annotations

import json
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.api.schemas import IndexedFileBatchUpsert, IndexedFileUpsert, NotificationCreate
from backend.app.models.entities import IndexedFile, WatchedFolder
from backend.app.services.metadata_extractor import extract_file_metadata
from backend.app.services.notification_service import NotificationService
from backend.app.services.settings_service import SettingsService


class DocumentService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.notifications = NotificationService(db)

    def upsert_batch(self, payload: IndexedFileBatchUpsert) -> dict:
        settings = SettingsService(self.db).get_settings()
        max_bytes = int(settings.get("maxFileSizeMb", 50)) * 1024 * 1024
        upserted = 0
        skipped = 0
        hash_to_first_id: dict[str, int] = {}

        for item in payload.files:
            if item.sizeBytes > max_bytes:
                skipped += 1
                continue
            if self._upsert_one(item, hash_to_first_id):
                upserted += 1

        for path in payload.removeMissingPaths:
            row = self.db.scalar(select(IndexedFile).where(IndexedFile.path == path))
            if row:
                from backend.app.services.embedding_service import EmbeddingService

                EmbeddingService(self.db).delete_for_document(row.id)
                row.index_status = "removed"

        self._recompute_duplicates()
        self.db.commit()

        from backend.app.services.embedding_worker import embedding_worker

        pending_ids: list[int] = []
        for item in payload.files:
            row = self.db.scalar(select(IndexedFile).where(IndexedFile.path == item.path))
            if row and row.embedding_status == "pending" and row.id:
                pending_ids.append(row.id)
        for doc_id in pending_ids:
            embedding_worker.enqueue(doc_id)

        return {"upserted": upserted, "skipped": skipped, "removed": len(payload.removeMissingPaths)}

    def _upsert_one(
        self, item: IndexedFileUpsert, hash_to_first_id: dict[str, int]
    ) -> IndexedFile | None:
        enriched = extract_file_metadata(item.path)
        metadata = {**item.metadata, **{k: v for k, v in enriched.items() if k != "preview"}}
        preview = item.contentPreview or enriched.get("preview")

        row = self.db.scalar(select(IndexedFile).where(IndexedFile.path == item.path))
        if not row:
            row = IndexedFile(path=item.path)
            self.db.add(row)

        prior_embed_hash = row.embedding_content_hash

        row.file_name = item.fileName
        row.extension = item.extension
        row.size_bytes = item.sizeBytes
        row.modified_at = item.modifiedAt
        row.content_hash = item.contentHash
        row.mime_type = item.mimeType or enriched.get("mimeType")
        row.index_status = item.indexStatus
        row.watched_folder_id = item.watchedFolderId
        row.error_message = item.errorMessage
        row.content_preview = preview if isinstance(preview, str) else None
        row.metadata_json = json.dumps(metadata)

        if item.contentHash:
            if item.contentHash in hash_to_first_id:
                row.duplicate_of_id = hash_to_first_id[item.contentHash]
            else:
                self.db.flush()
                hash_to_first_id[item.contentHash] = row.id

        if (
            row.index_status == "indexed"
            and row.duplicate_of_id is None
            and row.content_hash
        ):
            if row.embedding_content_hash != row.content_hash or row.embedding_status in (
                None,
                "pending",
                "failed",
            ):
                if row.embedding_status != "embedded" or row.embedding_content_hash != row.content_hash:
                    row.embedding_status = "pending"

        return row

    def recompute_duplicates(self) -> None:
        self._recompute_duplicates()
        self.db.commit()

    def _recompute_duplicates(self) -> None:
        rows = self.db.scalars(
            select(IndexedFile).where(
                IndexedFile.content_hash.isnot(None),
                IndexedFile.index_status != "removed",
            )
        ).all()
        first_by_hash: dict[str, int] = {}
        for row in sorted(rows, key=lambda r: r.id):
            if not row.content_hash:
                continue
            if row.content_hash not in first_by_hash:
                first_by_hash[row.content_hash] = row.id
                row.duplicate_of_id = None
            else:
                row.duplicate_of_id = first_by_hash[row.content_hash]

    def list_documents(
        self,
        page: int,
        page_size: int,
        sort_by: str,
        sort_dir: str,
        extension: str | None,
        folder_id: int | None,
        search: str | None,
        status: str | None,
    ) -> tuple[list[IndexedFile], int]:
        filters = [IndexedFile.index_status != "removed"]
        if extension:
            filters.append(IndexedFile.extension == extension)
        if folder_id:
            filters.append(IndexedFile.watched_folder_id == folder_id)
        if status:
            filters.append(IndexedFile.index_status == status)
        if search:
            filters.append(func.lower(IndexedFile.file_name).like(f"%{search.lower()}%"))

        total = self.db.scalar(select(func.count()).where(*filters)) or 0

        sort_map = {
            "fileName": IndexedFile.file_name,
            "sizeBytes": IndexedFile.size_bytes,
            "modifiedAt": IndexedFile.modified_at,
            "updatedAt": IndexedFile.updated_at,
        }
        sort_col = sort_map.get(sort_by, IndexedFile.updated_at)
        order = sort_col.desc() if sort_dir == "desc" else sort_col.asc()

        items = list(
            self.db.scalars(
                select(IndexedFile).where(*filters).order_by(order).offset((page - 1) * page_size).limit(page_size)
            ).all()
        )
        return items, total

    def stats(self) -> dict:
        total_indexed = self.db.scalar(
            select(func.count()).where(IndexedFile.index_status == "indexed")
        ) or 0
        total_pending = self.db.scalar(
            select(func.count()).where(IndexedFile.index_status == "pending")
        ) or 0
        total_failed = self.db.scalar(
            select(func.count()).where(IndexedFile.index_status == "failed")
        ) or 0
        total_duplicates = self.db.scalar(
            select(func.count()).where(IndexedFile.duplicate_of_id.isnot(None))
        ) or 0
        watched = self.db.scalar(select(func.count()).select_from(WatchedFolder)) or 0

        ext_rows = self.db.execute(
            select(IndexedFile.extension, func.count())
            .where(IndexedFile.index_status == "indexed")
            .group_by(IndexedFile.extension)
        ).all()
        by_extension = {ext or "unknown": count for ext, count in ext_rows}

        return {
            "totalIndexed": total_indexed,
            "totalPending": total_pending,
            "totalFailed": total_failed,
            "totalDuplicates": total_duplicates,
            "byExtension": by_extension,
            "watchedFolders": watched,
        }

    def mark_folder_scanned(self, folder_id: int) -> None:
        folder = self.db.get(WatchedFolder, folder_id)
        if folder:
            folder.last_scan_at = datetime.now(UTC)
            self.db.commit()

    def notify_index_complete(self, folder_path: str, count: int) -> None:
        settings = SettingsService(self.db).get_settings()
        if settings.get("notifications", {}).get("indexingComplete", True):
            self.notifications.create(
                NotificationCreate(
                    title="Indexing complete",
                    body=f"Indexed {count} files in {folder_path}",
                    category="indexing",
                    level="success",
                )
            )
