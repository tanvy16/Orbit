from __future__ import annotations

import queue
import threading
from typing import TYPE_CHECKING

from sqlalchemy import or_, select

from backend.app.core.logging import logger
from backend.app.database.session import SessionLocal
from backend.app.models.entities import IndexedFile
from backend.app.services.embedding_service import EmbeddingService

if TYPE_CHECKING:
    pass


class EmbeddingWorker:
    def __init__(self) -> None:
        self._queue: queue.Queue[int | str] = queue.Queue()
        self._thread = threading.Thread(target=self._run, name="orbit-embedding-worker", daemon=True)
        self._started = False
        self._rebuild_all = False

    def start(self) -> None:
        if self._started:
            return
        self._started = True
        self._thread.start()
        self.enqueue_backfill()
        logger.info("Embedding worker started")

    def enqueue(self, document_id: int) -> None:
        self._queue.put(document_id)

    def enqueue_backfill(self) -> None:
        self._queue.put("__backfill__")

    def request_rebuild(self) -> None:
        self._rebuild_all = True
        self._queue.put("__rebuild__")

    def _run(self) -> None:
        while True:
            item = self._queue.get()
            try:
                if item == "__backfill__":
                    self._backfill_pending()
                elif item == "__rebuild__":
                    self._rebuild()
                elif isinstance(item, int):
                    db = SessionLocal()
                    try:
                        EmbeddingService(db).embed_document(item)
                    finally:
                        db.close()
            except Exception:
                logger.exception("Embedding worker job failed: %s", item)
            finally:
                self._queue.task_done()

    def _backfill_pending(self) -> None:
        db = SessionLocal()
        try:
            rows = db.scalars(
                select(IndexedFile.id).where(
                    IndexedFile.index_status == "indexed",
                    IndexedFile.duplicate_of_id.is_(None),
                    or_(
                        IndexedFile.embedding_status.is_(None),
                        IndexedFile.embedding_status == "pending",
                        IndexedFile.embedding_status == "failed",
                        IndexedFile.embedding_content_hash != IndexedFile.content_hash,
                    ),
                )
            ).all()
            for doc_id in rows:
                self.enqueue(doc_id)
            logger.info("Embedding backfill queued %s documents", len(rows))
        finally:
            db.close()

    def _rebuild(self) -> None:
        db = SessionLocal()
        try:
            service = EmbeddingService(db)
            count = service.mark_all_pending()
            from backend.app.services.chroma_store import get_chroma_store

            get_chroma_store().reset()
            logger.info("Embedding rebuild reset — %s documents queued", count)
        finally:
            db.close()
        self.enqueue_backfill()


embedding_worker = EmbeddingWorker()
