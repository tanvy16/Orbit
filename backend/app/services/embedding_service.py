from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models.entities import IndexedFile
from backend.app.services.chroma_store import get_chroma_store
from backend.app.services.chunking import chunk_text
from backend.app.services.embedding_providers import get_embedding_provider
from backend.app.services.settings_service import SettingsService
from backend.app.services.text_extractor import extract_document_text
from backend.app.core.logging import logger


class EmbeddingService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _settings(self) -> dict:
        return SettingsService(self.db).get_settings()

    def embed_document(self, document_id: int) -> bool:
        row = self.db.get(IndexedFile, document_id)
        if not row or row.index_status != "indexed" or row.duplicate_of_id:
            return False

        settings = self._settings()
        if not settings.get("autoEmbedOnIndex", True):
            row.embedding_status = "skipped"
            self.db.commit()
            return False

        row.embedding_status = "processing"
        self.db.commit()

        try:
            text = extract_document_text(row.path)
            if not text.strip():
                row.embedding_status = "skipped"
                row.chunk_count = 0
                self.db.commit()
                get_chroma_store().delete_document(document_id)
                return True

            chunks = chunk_text(
                text,
                int(settings.get("chunkSize", 800)),
                int(settings.get("chunkOverlap", 120)),
            )
            provider = get_embedding_provider(
                settings.get("embeddingProvider", "sentence-transformers"),
                settings.get("embeddingModel", "all-MiniLM-L6-v2"),
                settings.get("ollamaBaseUrl", "http://127.0.0.1:11434"),
            )
            vectors = provider.embed_texts(chunks)
            ids = [f"doc_{document_id}_chunk_{i}" for i in range(len(chunks))]
            metadatas = [
                {
                    "document_id": document_id,
                    "path": row.path,
                    "file_name": row.file_name,
                    "extension": row.extension,
                    "chunk_index": i,
                    "watched_folder_id": row.watched_folder_id if row.watched_folder_id is not None else -1,
                }
                for i in range(len(chunks))
            ]
            get_chroma_store().upsert_chunks(document_id, ids, vectors, chunks, metadatas)

            row.embedding_status = "embedded"
            row.embedding_content_hash = row.content_hash
            row.chunk_count = len(chunks)
            row.embedded_at = datetime.now(UTC)
            row.error_message = None
            self.db.commit()
            return True
        except Exception as exc:
            logger.exception("Embedding failed for document %s", document_id)
            row.embedding_status = "failed"
            row.error_message = str(exc)
            self.db.commit()
            return False

    def delete_for_document(self, document_id: int) -> None:
        get_chroma_store().delete_document(document_id)
        row = self.db.get(IndexedFile, document_id)
        if row:
            row.embedding_content_hash = None
            row.chunk_count = 0
            row.embedded_at = None
            row.embedding_status = "skipped"
            self.db.commit()

    def mark_all_pending(self) -> int:
        rows = self.db.scalars(
            select(IndexedFile).where(
                IndexedFile.index_status == "indexed",
                IndexedFile.duplicate_of_id.is_(None),
            )
        ).all()
        count = 0
        for row in rows:
            row.embedding_status = "pending"
            row.embedding_content_hash = None
            count += 1
        self.db.commit()
        return count
