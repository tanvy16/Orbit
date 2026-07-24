from __future__ import annotations

import json
import time
from abc import ABC, abstractmethod
from collections.abc import Iterator
from functools import lru_cache
from typing import Any

import httpx

from backend.app.core.config import settings
from backend.app.core.logging import logger

DEFAULT_COPILOT_MODEL = "gemma3:4b"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"
LLM_TIMEOUT_SECONDS = 120.0
MAX_HISTORY_MESSAGES = 8
OLLAMA_KEEP_ALIVE = "10m"
OLLAMA_NUM_PREDICT = 512
OLLAMA_NUM_CTX = 4096

_HTTP_CLIENTS: dict[str, httpx.Client] = {}


def _http_client(base_url: str | None = None) -> httpx.Client:
    key = base_url or "openai"
    client = _HTTP_CLIENTS.get(key)
    if client is None:
        client = httpx.Client(timeout=LLM_TIMEOUT_SECONDS)
        _HTTP_CLIENTS[key] = client
    return client


class LLMProvider(ABC):
    @abstractmethod
    def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        *,
        history: list[dict[str, str]] | None = None,
    ) -> str:
        raise NotImplementedError

    def stream_complete(
        self,
        system_prompt: str,
        user_prompt: str,
        *,
        history: list[dict[str, str]] | None = None,
    ) -> Iterator[str]:
        yield self.complete(system_prompt, user_prompt, history=history)


def _build_messages(
    system_prompt: str,
    user_prompt: str,
    history: list[dict[str, str]] | None,
) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    for item in (history or [])[-MAX_HISTORY_MESSAGES:]:
        role = item.get("role")
        content = (item.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_prompt})
    return messages


class OllamaChatProvider(LLMProvider):
    def __init__(self, base_url: str, model: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._client = _http_client(self._base_url)

    def _payload(
        self,
        system_prompt: str,
        user_prompt: str,
        history: list[dict[str, str]] | None,
        *,
        stream: bool,
    ) -> dict[str, Any]:
        messages = _build_messages(system_prompt, user_prompt, history)
        prompt_chars = sum(len(item.get("content", "")) for item in messages)
        logger.info(
            "Copilot Ollama payload model=%s stream=%s promptChars=%s historyMsgs=%s",
            self._model,
            stream,
            prompt_chars,
            max(0, len(messages) - 2),
        )
        return {
            "model": self._model,
            "stream": stream,
            "keep_alive": OLLAMA_KEEP_ALIVE,
            "messages": messages,
            "options": {
                "temperature": 0.35,
                "top_p": 0.9,
                "num_predict": OLLAMA_NUM_PREDICT,
                "num_ctx": OLLAMA_NUM_CTX,
            },
        }

    def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        *,
        history: list[dict[str, str]] | None = None,
    ) -> str:
        started = time.perf_counter()
        response = self._client.post(
            f"{self._base_url}/api/chat",
            json=self._payload(system_prompt, user_prompt, history, stream=False),
        )
        response.raise_for_status()
        payload = response.json()
        message = payload.get("message") or {}
        content = message.get("content")
        if not content:
            raise RuntimeError("Ollama returned an empty response")
        elapsed = round((time.perf_counter() - started) * 1000, 1)
        logger.info(
            "Copilot Ollama complete model=%s elapsed=%sms chars=%s",
            self._model,
            elapsed,
            len(str(content)),
        )
        return str(content).strip()

    def stream_complete(
        self,
        system_prompt: str,
        user_prompt: str,
        *,
        history: list[dict[str, str]] | None = None,
    ) -> Iterator[str]:
        started = time.perf_counter()
        first_token_ms: float | None = None
        token_count = 0
        with self._client.stream(
            "POST",
            f"{self._base_url}/api/chat",
            json=self._payload(system_prompt, user_prompt, history, stream=True),
        ) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if not line:
                    continue
                try:
                    payload = json.loads(line)
                except json.JSONDecodeError:
                    logger.debug("Skipping non-JSON Ollama stream line")
                    continue
                if payload.get("done"):
                    break
                message = payload.get("message") or {}
                content = message.get("content")
                if content:
                    if first_token_ms is None:
                        first_token_ms = round((time.perf_counter() - started) * 1000, 1)
                    token_count += 1
                    yield str(content)
        total_ms = round((time.perf_counter() - started) * 1000, 1)
        logger.info(
            "Copilot Ollama stream model=%s firstToken=%sms total=%sms tokens=%s",
            self._model,
            first_token_ms if first_token_ms is not None else total_ms,
            total_ms,
            token_count,
        )


class OpenAIChatProvider(LLMProvider):
    def __init__(self, model: str, api_key: str) -> None:
        self._model = model
        self._api_key = api_key
        self._client = _http_client()

    def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        *,
        history: list[dict[str, str]] | None = None,
    ) -> str:
        response = self._client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {self._api_key}"},
            json={
                "model": self._model,
                "messages": _build_messages(system_prompt, user_prompt, history),
                "temperature": 0.3,
            },
        )
        response.raise_for_status()
        payload = response.json()
        choices = payload.get("choices") or []
        if not choices:
            raise RuntimeError("OpenAI returned no choices")
        content = choices[0].get("message", {}).get("content")
        if not content:
            raise RuntimeError("OpenAI returned empty content")
        return str(content).strip()

    def stream_complete(
        self,
        system_prompt: str,
        user_prompt: str,
        *,
        history: list[dict[str, str]] | None = None,
    ) -> Iterator[str]:
        with self._client.stream(
            "POST",
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {self._api_key}"},
            json={
                "model": self._model,
                "stream": True,
                "messages": _build_messages(system_prompt, user_prompt, history),
                "temperature": 0.3,
            },
        ) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if not line or not line.startswith("data: "):
                    continue
                data = line[6:].strip()
                if data == "[DONE]":
                    break
                try:
                    payload: dict[str, Any] = json.loads(data)
                except json.JSONDecodeError:
                    continue
                delta = (payload.get("choices") or [{}])[0].get("delta") or {}
                content = delta.get("content")
                if content:
                    yield str(content)


@lru_cache(maxsize=8)
def get_llm_provider(provider: str, model: str, ollama_base_url: str) -> LLMProvider:
    if provider == "openai":
        key = settings.openai_api_key
        if not key:
            raise RuntimeError(
                "OpenAI API key not configured. Set OPENAI_API_KEY in the environment."
            )
        return OpenAIChatProvider(model=model or DEFAULT_OPENAI_MODEL, api_key=key)
    return OllamaChatProvider(
        base_url=ollama_base_url,
        model=model or DEFAULT_COPILOT_MODEL,
    )
