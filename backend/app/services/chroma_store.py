from __future__ import annotations

from pathlib import Path
from threading import Lock

import chromadb
from chromadb.config import Settings as ChromaSettings

from backend.app.core.config import settings
from backend.app.core.logging import logger

COLLECTION_NAME = "orbit_knowledge"


class ChromaStore:
    def __init__(self) -> None:
        Path(settings.orbit_chroma_path).mkdir(parents=True, exist_ok=True)
        self._client = chromadb.PersistentClient(
            path=settings.orbit_chroma_path,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        self._collection = self._client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        self._lock = Lock()

    @property
    def collection(self):
        return self._collection

    def delete_document(self, document_id: int) -> None:
        with self._lock:
            try:
                self._collection.delete(where={"document_id": document_id})
            except Exception as exc:
                logger.debug("Chroma delete doc %s: %s", document_id, exc)

    def upsert_chunks(
        self,
        document_id: int,
        ids: list[str],
        embeddings: list[list[float]],
        documents: list[str],
        metadatas: list[dict],
    ) -> None:
        with self._lock:
            self.delete_document(document_id)
            if not ids:
                return
            self._collection.add(
                ids=ids,
                embeddings=embeddings,
                documents=documents,
                metadatas=metadatas,
            )

    def query(
        self,
        embedding: list[float],
        n_results: int,
        where: dict | None = None,
    ) -> dict:
        with self._lock:
            kwargs: dict = {
                "query_embeddings": [embedding],
                "n_results": n_results,
                "include": ["documents", "metadatas", "distances"],
            }
            if where:
                kwargs["where"] = where
            return self._collection.query(**kwargs)

    def count(self) -> int:
        with self._lock:
            return self._collection.count()

    def reset(self) -> None:
        with self._lock:
            self._client.delete_collection(COLLECTION_NAME)
            self._collection = self._client.get_or_create_collection(
                name=COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"},
            )


_chroma_store: ChromaStore | None = None


def get_chroma_store() -> ChromaStore:
    global _chroma_store
    if _chroma_store is None:
        _chroma_store = ChromaStore()
    return _chroma_store
