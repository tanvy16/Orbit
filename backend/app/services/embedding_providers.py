from __future__ import annotations

from abc import ABC, abstractmethod
from functools import lru_cache

import httpx

from backend.app.core.logging import logger


class EmbeddingProvider(ABC):
    @abstractmethod
    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError

    @property
    @abstractmethod
    def model_name(self) -> str:
        raise NotImplementedError


class SentenceTransformerProvider(EmbeddingProvider):
    def __init__(self, model_name: str) -> None:
        self._model_name = model_name
        self._model = None

    @property
    def model_name(self) -> str:
        return self._model_name

    def _load(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(self._model_name)
        return self._model

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        model = self._load()
        vectors = model.encode(texts, batch_size=32, show_progress_bar=False)
        return [vector.tolist() for vector in vectors]


class OllamaEmbeddingProvider(EmbeddingProvider):
    def __init__(self, base_url: str, model_name: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._model_name = model_name

    @property
    def model_name(self) -> str:
        return self._model_name

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        with httpx.Client(timeout=120.0) as client:
            for text in texts:
                response = client.post(
                    f"{self._base_url}/api/embeddings",
                    json={"model": self._model_name, "prompt": text},
                )
                response.raise_for_status()
                payload = response.json()
                vectors.append(payload["embedding"])
        return vectors


@lru_cache(maxsize=4)
def get_embedding_provider(provider: str, model: str, ollama_url: str) -> EmbeddingProvider:
    if provider == "ollama":
        return OllamaEmbeddingProvider(ollama_url, model)
    return SentenceTransformerProvider(model)
