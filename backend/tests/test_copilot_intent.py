"""Tests for copilot RAG intent routing."""

from backend.ai.intent import classify_intents, should_use_rag


def test_desktop_skips_rag():
    assert should_use_rag("Why is my laptop slow?") is False
    assert should_use_rag("Analyze my system health") is False
    assert should_use_rag("What is using my RAM?") is False
    assert should_use_rag("Summarize current system status") is False


def test_document_uses_rag():
    assert should_use_rag("Summarize my report") is True
    assert should_use_rag("Search my indexed files") is True
    assert should_use_rag("What does notes.pdf contain?") is True
    assert should_use_rag("Find invoice") is True


def test_document_mention_is_hybrid_not_rag_llm():
    assert should_use_rag("What documents mention machine learning?") is False
    intents = classify_intents("What documents mention machine learning?")
    assert intents["direct_answer"] is True
    assert intents["rag"] is True


def test_casual_is_llm_only():
    intents = classify_intents("Hello")
    assert intents["casual"] is True
    assert intents["rag"] is False
    assert intents["telemetry"] is False
    assert intents["recommendations"] is False


def test_system_question_runs_telemetry_only():
    intents = classify_intents("Why is my PC slow?")
    assert intents["casual"] is False
    assert intents["rag"] is False
    assert intents["telemetry"] is True
    assert intents["processes"] is False
    assert intents["recommendations"] is False
    assert intents["indexing"] is False


def test_general_is_llm_only():
    intents = classify_intents("Explain quantum computing in simple terms")
    assert intents["general"] is True
    assert intents["telemetry"] is False
    assert intents["rag"] is False


def test_process_question_runs_process_scan():
    intents = classify_intents("Why are so many processes running")
    assert intents["telemetry"] is True
    assert intents["processes"] is True


def test_duplicate_question_runs_duplicate_path():
    intents = classify_intents("Find duplicate files")
    assert intents["duplicates"] is True
    assert intents["direct_answer"] is True
    assert intents["rag"] is False
