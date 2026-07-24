from __future__ import annotations

import re
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.ai.analyzer import build_analysis_bundle
from backend.ai.copilot_cache import (
    get_cached_analysis_bundle,
    get_cached_doc_stats,
    get_cached_embed_stats,
    get_cached_rag_items,
)
from backend.ai.duplicates_intel import collect_duplicate_groups, format_duplicates_reply
from backend.ai.fuzzy import extract_rag_query
from backend.ai.perf import PipelineTimer
from backend.ai.query_patterns import (
    is_document_search_query,
    is_duplicate_list_query,
    is_factual_lookup,
    is_system_health_lookup,
    needs_generation,
    needs_reasoning,
)
from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.database.session import SessionLocal, engine
from backend.app.services.chroma_store import get_chroma_store
from backend.app.services.document_service import DocumentService
from backend.app.services.llm_providers import DEFAULT_COPILOT_MODEL
from backend.app.services.search_service import EmbeddingStatsService, SearchService
from backend.app.services.settings_service import SettingsService
from backend.app.services.task_service import TaskService
from backend.monitoring.cache import get_cached_snapshot


def classify_hybrid_route(message: str) -> dict[str, Any] | None:
    """Return a hybrid route dict or None when the LLM should handle the prompt."""
    text = message.strip().lower()
    if not text:
        return None

    if is_duplicate_list_query(text):
        include_semantic = any(
            phrase in text for phrase in ("near duplicate", "similar file", "semantic duplicate")
        )
        return {
            "type": "duplicates_list",
            "params": {"include_semantic": include_semantic},
        }

    if is_document_search_query(text):
        query = extract_rag_query(message)
        if query and len(query) >= 2:
            return {"type": "document_search", "params": {"query": query}}

    if needs_reasoning(text) or needs_generation(text):
        return None

    if is_system_health_lookup(text):
        return {"type": "system_health", "params": {}}

    factual = is_factual_lookup(text)

    if factual and ("chroma" in text or "chromadb" in text):
        return {"type": "chroma_status", "params": {}}
    if factual and any(token in text for token in ("fastapi", "api status", "backend status", "orbit api")):
        return {"type": "api_status", "params": {}}
    if factual and "queue" in text and "status" in text:
        return {"type": "queue_status", "params": {}}
    if factual and "vector" in text and "chunk" in text:
        return {"type": "vector_chunks", "params": {}}
    if factual and "indexed" in text and "document" in text:
        return {"type": "indexed_documents", "params": {}}
    if factual and "embed" in text:
        return {"type": "embeddings", "params": {}}

    if not factual:
        return None

    if re.search(r"\b(process|processes)\b", text) and any(
        token in text for token in ("running", "count", "how many", "list")
    ):
        return {"type": "process_count", "params": {}}
    if "network" in text or ("upload" in text and "download" in text):
        return {"type": "network", "params": {}}
    if "battery" in text:
        return {"type": "battery", "params": {}}
    if "gpu" in text or "graphics" in text:
        return {"type": "gpu", "params": {}}
    if re.search(r"\b(disk|storage|drive|space)\b", text):
        return {"type": "disk", "params": {}}
    if re.search(r"\b(ram|memory)\b", text):
        if re.search(r"\b(how much|what is|what's|usage|percent|percentage|level)\b", text):
            return {"type": "ram", "params": {}}
        if any(
            token in text
            for token in ("process", "consumer", "app", "top", "which", "what is using", "memory hog")
        ):
            return {"type": "processes", "params": {}}
        return {"type": "ram", "params": {}}
    if re.search(r"\b(cpu|processor)\b", text):
        return {"type": "cpu", "params": {}}

    return None


def classify_direct_query(message: str) -> str | None:
    """Backward-compatible query type for tests and intent routing."""
    route = classify_hybrid_route(message)
    return route["type"] if route else None


def _format_bytes(num: int) -> str:
    if num < 1024**2:
        return f"{num / 1024:.1f} KB"
    if num < 1024**3:
        return f"{num / 1024**2:.1f} MB"
    return f"{num / 1024**3:.2f} GB"


def _format_speed(num: int) -> str:
    return f"{_format_bytes(num)}/s"


def _compact_context_panel(telemetry: dict) -> dict:
    cpu = telemetry.get("cpu", {})
    mem = telemetry.get("memory", {})
    bat = telemetry.get("battery", {})
    gpu = telemetry.get("gpu", {})
    return {
        "cpuPercent": cpu.get("usagePercent"),
        "ramPercent": mem.get("usagePercent"),
        "diskPercent": telemetry.get("disk", {}).get("usagePercent"),
        "batteryPercent": bat.get("percent") if bat.get("available") else None,
        "batteryCharging": bat.get("charging") if bat.get("available") else None,
        "processCount": telemetry.get("processes", {}).get("count"),
        "gpuPercent": gpu.get("usagePercent") if gpu.get("available") else None,
    }


def _health_status(db_status: str, chroma_status: str) -> dict[str, str]:
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "database": db_status,
        "chroma": chroma_status,
        "overall": "ok" if db_status == "ok" and chroma_status == "ok" else "degraded",
    }


def _fetch_rag_items_uncached(query: str) -> list[dict]:
    db = SessionLocal()
    try:
        result = SearchService(db).semantic_search(query, 1, 5, None, None)
        return result.get("items") or []
    except Exception as exc:
        logger.warning("Hybrid document search skipped: %s", exc)
        return []
    finally:
        db.close()


def _format_document_search_reply(query: str, items: list[dict]) -> str:
    if not items:
        return f"No indexed documents matched **{query}**."

    lines = [f"Found **{len(items)}** indexed document(s) matching **{query}**:\n"]
    for item in items[:5]:
        similarity = item.get("similarity")
        snippet = (item.get("snippet") or "").strip()
        snippet_line = f"\n  > {snippet[:180]}…" if len(snippet) > 180 else (f"\n  > {snippet}" if snippet else "")
        lines.append(
            f"- **{item.get('fileName')}** (similarity {similarity}){snippet_line}"
        )
    return "\n".join(lines)


def _base_response(
    *,
    reply: str,
    settings_data: dict,
    model_used: str,
    query_type: str,
    panel: dict | None = None,
    bundle: dict | None = None,
    document_search: bool = False,
    document_sources: list[dict] | None = None,
) -> dict:
    bundle = bundle or {}
    return {
        "reply": reply,
        "systemContext": panel or {},
        "healthSummary": bundle.get("health", {}),
        "documentSearchUsed": document_search,
        "directAnswer": True,
        "copilotProvider": settings_data.get("copilotProvider", "ollama"),
        "modelUsed": model_used,
        "documentSources": document_sources or [],
        "analysis": {
            "performance": bundle.get("performance", {}),
            "memory": bundle.get("memory", {}),
            "processes": bundle.get("processes", {}),
        },
        "recommendations": [],
        "intents": {
            "direct_answer": True,
            "direct_query": query_type,
            "needs_llm": False,
        },
    }


def build_hybrid_answer(route: dict[str, Any], db: Session, *, message: str = "") -> dict:
    query_type = route["type"]
    params = route.get("params") or {}
    settings_data = SettingsService(db).get_settings()
    model_used = settings_data.get("copilotModel", DEFAULT_COPILOT_MODEL)

    if query_type == "document_search":
        search_query = str(params.get("query") or extract_rag_query(message))
        items = get_cached_rag_items(search_query, lambda: _fetch_rag_items_uncached(search_query))
        reply = _format_document_search_reply(search_query, items)
        return _base_response(
            reply=reply,
            settings_data=settings_data,
            model_used=model_used,
            query_type=query_type,
            document_search=True,
            document_sources=[
                {
                    "documentId": item.get("documentId"),
                    "fileName": item.get("fileName"),
                    "path": item.get("path"),
                    "similarity": item.get("similarity"),
                }
                for item in items
            ],
        )

    if query_type == "duplicates_list":
        groups = collect_duplicate_groups(
            db,
            include_near_filename=True,
            include_semantic=bool(params.get("include_semantic")),
        )
        reply = format_duplicates_reply(groups)
        return _base_response(
            reply=reply,
            settings_data=settings_data,
            model_used=model_used,
            query_type=query_type,
        )

    include_processes = query_type in {"processes", "process_count"}
    include_temperatures = query_type == "system_health"
    telemetry = get_cached_snapshot(include_processes=include_processes)
    bundle = get_cached_analysis_bundle(
        f"{telemetry.get('timestamp')}:{include_processes}:{include_temperatures}",
        lambda: build_analysis_bundle(telemetry, include_temperatures=include_temperatures),
    )
    panel = _compact_context_panel(telemetry)

    cpu = telemetry.get("cpu", {})
    mem = telemetry.get("memory", {})
    disk = telemetry.get("disk", {})
    net = telemetry.get("network", {})
    bat = telemetry.get("battery", {})
    gpu = telemetry.get("gpu", {})
    procs = telemetry.get("processes", {})
    health = bundle.get("health", {})
    perf = bundle.get("performance", {})
    mem_a = bundle.get("memory", {})

    reply = ""

    if query_type == "cpu":
        reply = (
            f"**CPU usage:** {cpu.get('usagePercent')}% across {cpu.get('coreCount')} cores.\n\n"
            f"Pressure: {perf.get('pressure', 'unknown')} — {perf.get('summary', '')}"
        )
    elif query_type == "ram":
        reply = (
            f"**Memory usage:** {mem.get('usagePercent')}% "
            f"({_format_bytes(int(mem.get('usedBytes', 0)))} used of "
            f"{_format_bytes(int(mem.get('totalBytes', 0)))}).\n\n"
            f"{mem_a.get('summary', '')}"
        )
    elif query_type == "disk":
        reply = (
            f"**Disk usage:** {disk.get('usagePercent')}% "
            f"({_format_bytes(int(disk.get('freeBytes', 0)))} free of "
            f"{_format_bytes(int(disk.get('totalBytes', 0)))})."
        )
    elif query_type == "gpu":
        if gpu.get("available"):
            reply = f"**GPU usage:** {gpu.get('usagePercent')}% ({gpu.get('name') or 'GPU'})."
        else:
            reply = "**GPU:** No GPU telemetry is available on this system."
    elif query_type == "battery":
        if bat.get("available"):
            charging = "charging" if bat.get("charging") else "on battery"
            reply = f"**Battery:** {bat.get('percent')}% ({charging})."
        else:
            reply = "**Battery:** No battery detected (likely a desktop PC)."
    elif query_type == "network":
        reply = (
            f"**Network activity:** "
            f"download {_format_speed(int(net.get('downloadBytesPerSec', 0)))}, "
            f"upload {_format_speed(int(net.get('uploadBytesPerSec', 0)))}."
        )
    elif query_type == "process_count":
        reply = f"**Running processes:** {procs.get('count', 0)} detected."
    elif query_type == "processes":
        items = procs.get("items") or mem.get("topProcesses") or []
        top_mem = sorted(items, key=lambda p: int(p.get("memoryBytes", 0)), reverse=True)[:5]
        top_cpu = sorted(items, key=lambda p: float(p.get("cpuPercent", 0)), reverse=True)[:5]
        mem_lines = [
            f"- {item.get('name')}: {_format_bytes(int(item.get('memoryBytes', 0)))}"
            for item in top_mem
            if item.get("name")
        ]
        cpu_lines = [
            f"- {item.get('name')}: {item.get('cpuPercent')}% CPU"
            for item in top_cpu
            if item.get("name")
        ]
        reply = "**Top resource consumers:**\n"
        reply += "**Memory:**\n" + ("\n".join(mem_lines) if mem_lines else "- No process sample available.")
        if cpu_lines:
            reply += "\n\n**CPU:**\n" + "\n".join(cpu_lines)
    elif query_type == "system_health":
        issues = health.get("detectedIssues") or []
        issue_lines = "\n".join(f"- {issue}" for issue in issues[:5]) or "- No critical issues detected"
        reply = (
            f"**System health score:** {health.get('score')}/100 ({health.get('performance')})\n\n"
            f"**Detected issues:**\n{issue_lines}\n\n"
            f"**Summary:** {perf.get('summary', '')} {mem_a.get('summary', '')}"
        )
    elif query_type == "indexed_documents":
        stats = get_cached_doc_stats(lambda: DocumentService(db).stats())
        reply = (
            f"**Indexed documents:** {stats.get('totalIndexed', 0)}\n"
            f"- Pending: {stats.get('totalPending', 0)}\n"
            f"- Failed: {stats.get('totalFailed', 0)}\n"
            f"- Watched folders: {stats.get('watchedFolders', 0)}"
        )
    elif query_type == "embeddings":
        embed = get_cached_embed_stats(lambda: EmbeddingStatsService(db).compute())
        reply = (
            f"**Embeddings:**\n"
            f"- Embedded: {embed.get('documentsEmbedded', 0)}\n"
            f"- Pending: {embed.get('documentsPending', 0)}\n"
            f"- Processing: {embed.get('documentsProcessing', 0)}\n"
            f"- Failed: {embed.get('documentsFailed', 0)}"
        )
    elif query_type == "vector_chunks":
        embed = get_cached_embed_stats(lambda: EmbeddingStatsService(db).compute())
        reply = (
            f"**Vector index:** {embed.get('vectorChunks', 0)} chunks "
            f"({'healthy' if embed.get('chromaOk') else 'degraded'})."
        )
    elif query_type == "chroma_status":
        embed = get_cached_embed_stats(lambda: EmbeddingStatsService(db).compute())
        status = "ok" if embed.get("chromaOk") else "error"
        detail = "" if embed.get("chromaOk") else f"\n- Detail: {embed.get('chromaError') or 'unknown'}"
        reply = f"**ChromaDB status:** {status}{detail}"
    elif query_type == "api_status":
        db_status = "ok"
        chroma_status = "ok"
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
        except Exception:
            db_status = "error"
        try:
            get_chroma_store().ping()
        except Exception:
            chroma_status = "error"
        health_api = _health_status(db_status, chroma_status)
        reply = (
            f"**Orbit API status:** {health_api['overall']}\n"
            f"- Service: {health_api['service']} {health_api['version']}\n"
            f"- SQLite: {health_api['database']}\n"
            f"- ChromaDB: {health_api['chroma']}"
        )
    elif query_type == "queue_status":
        active = TaskService(db).list_active()
        if not active:
            reply = "**Background queue:** No active tasks."
        else:
            lines = [f"- {task.task_type}: {task.status}" for task in active[:8]]
            reply = f"**Background queue:** {len(active)} active task(s)\n" + "\n".join(lines)
    else:
        reply = "I could not resolve that system query."

    return _base_response(
        reply=reply,
        settings_data=settings_data,
        model_used=model_used,
        query_type=query_type,
        panel=panel,
        bundle=bundle,
    )


def try_direct_response(db: Session, message: str) -> dict | None:
    timer = PipelineTimer(label=f"direct:{message[:32]}")
    route = classify_hybrid_route(message)
    timer.mark("intent")
    if not route:
        return None
    response = build_hybrid_answer(route, db, message=message)
    timer.mark("directAnswer")
    profile = timer.finish(extra=f"query={route['type']}")
    response["profile"] = profile
    return response
