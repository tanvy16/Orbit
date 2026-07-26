"""Central AI configuration — single source of truth for model defaults."""

from __future__ import annotations

# Local Ollama chat model (Phase 5.6 default)
DEFAULT_LOCAL_MODEL = "qwen3:8b"

# Backward-compatible alias used across the codebase
DEFAULT_COPILOT_MODEL = DEFAULT_LOCAL_MODEL

DEFAULT_EMBEDDING_MODEL = "nomic-embed-text"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"
DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434"

# Ollama runtime tuning
OLLAMA_KEEP_ALIVE = "30m"
OLLAMA_NUM_PREDICT = 512
OLLAMA_NUM_CTX = 4096
LLM_TIMEOUT_SECONDS = 120.0
OLLAMA_TAGS_TIMEOUT_SECONDS = 8.0
MAX_HISTORY_MESSAGES = 6
MAX_CASUAL_HISTORY_MESSAGES = 0

# Provider identifiers
PROVIDER_OLLAMA = "ollama"
PROVIDER_OPENAI = "openai"
