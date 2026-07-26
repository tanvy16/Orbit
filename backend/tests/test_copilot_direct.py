"""Tests for hybrid direct-answer routing."""

from backend.ai.direct import classify_direct_query, classify_hybrid_route
from backend.ai.fuzzy import extract_rag_query
from backend.ai.intent import classify_intents


def test_direct_cpu_skips_llm():
    assert classify_direct_query("What is my CPU usage?") == "cpu"
    intents = classify_intents("What is my CPU usage?")
    assert intents["direct_answer"] is True
    assert intents["needs_llm"] is False
    assert intents["telemetry"] is True
    assert intents["rag"] is False


def test_direct_ram_skips_llm():
    assert classify_direct_query("How much RAM am I using?") == "ram"
    intents = classify_intents("How much RAM am I using?")
    assert intents["direct_answer"] is True
    assert intents["needs_llm"] is False


def test_reasoning_cpu_uses_llm():
    assert classify_direct_query("Explain why CPU usage is high") is None
    intents = classify_intents("Explain why CPU usage is high")
    assert intents["direct_answer"] is False
    assert intents["telemetry"] is True


def test_direct_chroma_status():
    assert classify_direct_query("What is the ChromaDB status?") == "chroma_status"


def test_duplicate_list_skips_llm():
    route = classify_hybrid_route("List duplicate files")
    assert route is not None
    assert route["type"] == "duplicates_list"
    intents = classify_intents("Find duplicate files")
    assert intents["direct_answer"] is True
    assert intents["duplicates"] is True
    assert intents["needs_llm"] is False


def test_document_search_skips_llm():
    route = classify_hybrid_route("What documents mention machine learning?")
    assert route is not None
    assert route["type"] == "document_search"
    assert "machine learning" in route["params"]["query"].lower()
    intents = classify_intents("What documents mention machine learning?")
    assert intents["direct_answer"] is True
    assert intents["needs_llm"] is False


def test_document_summarize_uses_llm():
    assert classify_hybrid_route("Summarize documents about machine learning") is None
    intents = classify_intents("Summarize documents about machine learning")
    assert intents["direct_answer"] is False
    assert intents["rag"] is True


def test_extract_rag_query_strips_question_phrasing():
    query = extract_rag_query("What documents mention machine learning?")
    assert "machine learning" in query.lower()
    assert "what documents" not in query.lower()


def test_general_still_uses_llm_only():
    intents = classify_intents("Explain recursion in simple terms")
    assert intents["general"] is True
    assert intents["direct_answer"] is False
    assert intents["telemetry"] is False
