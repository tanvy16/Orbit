from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from backend.app.models.entities import IndexedFile
from backend.app.services.chroma_store import get_chroma_store
from backend.app.services.chunking import highlight_snippet
from backend.app.services.embedding_providers import get_embedding_provider
from backend.app.services.settings_service import SettingsService
from backend.app.core.logging import logger

_search_stats = {"totalQueries": 0}


def _needs_embedding_clause():
    return or_(
        IndexedFile.embedding_status.is_(None),
        IndexedFile.embedding_status == "pending",
        IndexedFile.embedding_status == "failed",
        IndexedFile.embedding_content_hash.is_(None),
        IndexedFile.embedding_content_hash != IndexedFile.content_hash,
    )


class SearchService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def semantic_search(
        self,
        query: str,
        page: int,
        page_size: int,
        folder_id: int | None,
        extension: str | None,
    ) -> dict:
        _search_stats["totalQueries"] += 1
        trimmed = query.strip()
        if not trimmed:
            return self._empty_response(trimmed, page, page_size)

        chroma = get_chroma_store()
        if chroma.count() == 0:
            return self._empty_response(trimmed, page, page_size)

        settings = SettingsService(self.db).get_settings()
        provider = get_embedding_provider(
            settings.get("embeddingProvider", "sentence-transformers"),
            settings.get("embeddingModel", "all-MiniLM-L6-v2"),
            settings.get("ollamaBaseUrl", "http://127.0.0.1:11434"),
        )
        try:
            query_vector = provider.embed_texts([trimmed])[0]
        except Exception as exc:
            logger.exception("Query embedding failed")
            raise RuntimeError(f"Embedding model unavailable: {exc}") from exc

        where: dict | None = None
        filters: list[dict] = []
        if folder_id is not None:
            filters.append({"watched_folder_id": folder_id})
        if extension:
            filters.append({"extension": extension})
        if len(filters) == 1:
            where = filters[0]
        elif len(filters) > 1:
            where = {"$and": filters}

        try:
            raw = chroma.query(
                query_vector,
                n_results=min(page_size * 10, 200),
                where=where,
            )
        except Exception as exc:
            logger.exception("Chroma query failed")
            raise RuntimeError(f"Vector search failed: {exc}") from exc

        ids = raw.get("ids", [[]])[0]
        distances = raw.get("distances", [[]])[0]
        documents = raw.get("documents", [[]])[0]
        metadatas = raw.get("metadatas", [[]])[0]

        best_by_doc: dict[int, dict] = {}
        for idx, chunk_id in enumerate(ids):
            meta = metadatas[idx] or {}
            doc_id = int(meta.get("document_id", 0))
            if doc_id <= 0:
                continue
            distance = float(distances[idx]) if distances else 1.0
            similarity = max(0.0, 1.0 - distance)
            snippet = highlight_snippet(documents[idx] or "", trimmed)
            existing = best_by_doc.get(doc_id)
            if not existing or similarity > existing["similarity"]:
                best_by_doc[doc_id] = {
                    "documentId": doc_id,
                    "similarity": round(similarity, 4),
                    "snippet": snippet,
                    "chunkId": chunk_id,
                    "path": meta.get("path"),
                    "fileName": meta.get("file_name"),
                    "extension": meta.get("extension"),
                }

        ranked = sorted(best_by_doc.values(), key=lambda x: x["similarity"], reverse=True)
        total = len(ranked)
        start = (page - 1) * page_size
        page_items = ranked[start : start + page_size]

        enriched = []
        for item in page_items:
            row = self.db.get(IndexedFile, item["documentId"])
            if not row or row.index_status == "removed":
                continue
            enriched.append(
                {
                    **item,
                    "fileName": row.file_name,
                    "path": row.path,
                    "extension": row.extension,
                    "sizeBytes": row.size_bytes,
                    "watchedFolderId": row.watched_folder_id,
                    "embeddingStatus": row.embedding_status or "pending",
                }
            )

        total_pages = max(1, (total + page_size - 1) // page_size) if total else 1
        return {
            "items": enriched,
            "page": page,
            "pageSize": page_size,
            "total": total,
            "totalPages": total_pages,
            "query": trimmed,
        }

    @staticmethod
    def _empty_response(query: str, page: int, page_size: int) -> dict:
        return {
            "items": [],
            "page": page,
            "pageSize": page_size,
            "total": 0,
            "totalPages": 1,
            "query": query,
        }

    @staticmethod
    def search_stats() -> dict:
        return dict(_search_stats)


class EmbeddingStatsService:
    """Single source of truth for dashboard embedding metrics."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def compute(self) -> dict:
        indexed_filter = (
            IndexedFile.index_status == "indexed",
            IndexedFile.duplicate_of_id.is_(None),
        )

        embedded = self.db.scalar(
            select(func.count()).where(*indexed_filter, IndexedFile.embedding_status == "embedded")
        ) or 0
        processing = self.db.scalar(
            select(func.count()).where(*indexed_filter, IndexedFile.embedding_status == "processing")
        ) or 0
        failed = self.db.scalar(
            select(func.count()).where(*indexed_filter, IndexedFile.embedding_status == "failed")
        ) or 0
        pending = self.db.scalar(
            select(func.count()).where(*indexed_filter, _needs_embedding_clause())
        ) or 0
        skipped = self.db.scalar(
            select(func.count()).where(*indexed_filter, IndexedFile.embedding_status == "skipped")
        ) or 0

        sql_chunk_total = self.db.scalar(
            select(func.coalesce(func.sum(IndexedFile.chunk_count), 0)).where(
                *indexed_filter,
                IndexedFile.embedding_status == "embedded",
            )
        ) or 0

        chroma_ok = False
        chroma_vectors = 0
        chroma_error: str | None = None
        try:
            store = get_chroma_store()
            store.ping()
            chroma_vectors = store.count()
            chroma_ok = True
        except Exception as exc:
            chroma_error = str(exc)
            chroma_vectors = int(sql_chunk_total)

        return {
            "documentsEmbedded": embedded,
            "documentsPending": pending,
            "documentsProcessing": processing,
            "documentsFailed": failed,
            "documentsSkipped": skipped,
            "vectorChunks": chroma_vectors,
            "sqlChunkTotal": int(sql_chunk_total),
            "chromaOk": chroma_ok,
            "chromaError": chroma_error,
        }
