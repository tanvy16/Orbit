from backend.app.core.ai_config import (
    DEFAULT_COPILOT_MODEL,
    DEFAULT_EMBEDDING_MODEL,
    DEFAULT_LOCAL_MODEL,
    MAX_HISTORY_MESSAGES,
)


def test_default_local_model_is_qwen():
    assert DEFAULT_LOCAL_MODEL == "qwen3:8b"
    assert DEFAULT_COPILOT_MODEL == DEFAULT_LOCAL_MODEL


def test_embedding_model_default():
    assert DEFAULT_EMBEDDING_MODEL == "nomic-embed-text"


def test_history_limit_is_reasonable():
    assert 0 < MAX_HISTORY_MESSAGES <= 12
