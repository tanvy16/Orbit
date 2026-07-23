from __future__ import annotations

from sqlalchemy.orm import Session

from backend.app.models.entities import IndexedFile
from backend.app.services.chroma_store import get_chroma_store
from backend.app.services.chunking import highlight_snippet
from backend.app.services.embedding_providers import get_embedding_provider
from backend.app.services.settings_service import SettingsService

_search_stats = {"totalQueries": 0}


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
        settings = SettingsService(self.db).get_settings()
        provider = get_embedding_provider(
            settings.get("embeddingProvider", "sentence-transformers"),
            settings.get("embeddingModel", "all-MiniLM-L6-v2"),
            settings.get("ollamaBaseUrl", "http://127.0.0.1:11434"),
        )
        query_vector = provider.embed_texts([query.strip()])[0]

        where: dict | None = None
        filters: list[dict] = []
        if folder_id:
            filters.append({"watched_folder_id": folder_id})
        if extension:
            filters.append({"extension": extension})
        if len(filters) == 1:
            where = filters[0]
        elif len(filters) > 1:
            where = {"$and": filters}

        raw = get_chroma_store().query(
            query_vector,
            n_results=min(page_size * 10, 200),
            where=where,
        )

        ids = raw.get("ids", [[]])[0]
        distances = raw.get("distances", [[]])[0]
        documents = raw.get("documents", [[]])[0]
        metadatas = raw.get("metadatas", [[]])[0]

        best_by_doc: dict[int, dict] = {}
        for idx, chunk_id in enumerate(ids):
            meta = metadatas[idx] or {}
            doc_id = int(meta.get("document_id", 0))
            distance = float(distances[idx]) if distances else 1.0
            similarity = max(0.0, 1.0 - distance)
            snippet = highlight_snippet(documents[idx] or "", query)
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
                    "embeddingStatus": row.embedding_status,
                }
            )

        total_pages = max(1, (total + page_size - 1) // page_size)
        return {
            "items": enriched,
            "page": page,
            "pageSize": page_size,
            "total": total,
            "totalPages": total_pages,
            "query": query,
        }

    @staticmethod
    def search_stats() -> dict:
        return dict(_search_stats)
