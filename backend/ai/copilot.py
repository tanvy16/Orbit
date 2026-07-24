from __future__ import annotations

from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from sqlalchemy.orm import Session

from backend.ai.analyzer import build_analysis_bundle
from backend.ai.copilot_cache import get_cached_doc_stats, get_cached_embed_stats, get_cached_storage_context
from backend.ai.duplicates_intel import build_duplicates_context
from backend.ai.fuzzy import expand_search_query
from backend.ai.intent import classify_intents
from backend.ai.perf import PipelineTimer
from backend.ai.prompts import (
    ORBIT_COPILOT_SYSTEM,
    ORBIT_COPILOT_SYSTEM_BRIEF,
    RAG_CONTEXT_HEADER,
    TELEMETRY_CONTEXT_HEADER,
)
from backend.ai.recommendations import build_recommendations
from backend.ai.storage_intel import build_storage_context
from backend.app.core.logging import logger
from backend.app.database.session import SessionLocal
from backend.app.services.document_service import DocumentService
from backend.app.services.llm_providers import DEFAULT_COPILOT_MODEL, get_llm_provider
from backend.app.services.search_service import EmbeddingStatsService, SearchService
from backend.app.services.settings_service import SettingsService
from backend.monitoring.cache import get_cached_snapshot

MAX_HISTORY_MESSAGES = 6
RAG_TOP_K = 2
RAG_SNIPPET_CHARS = 200


def _trim_history(history: list[dict[str, str]] | None) -> list[dict[str, str]]:
    if not history:
        return []
    return history[-MAX_HISTORY_MESSAGES:]


def _format_bytes(num: int) -> str:
    if num < 1024**2:
        return f"{num / 1024:.1f} KB"
    if num < 1024**3:
        return f"{num / 1024**2:.1f} MB"
    return f"{num / 1024**3:.2f} GB"


def _compact_context_panel(telemetry: dict | None) -> dict:
    if not telemetry:
        return {}
    cpu = telemetry.get("cpu", {})
    mem = telemetry.get("memory", {})
    bat = telemetry.get("battery", {})
    return {
        "cpuPercent": cpu.get("usagePercent"),
        "ramPercent": mem.get("usagePercent"),
        "diskPercent": telemetry.get("disk", {}).get("usagePercent"),
        "batteryPercent": bat.get("percent") if bat.get("available") else None,
        "batteryCharging": bat.get("charging") if bat.get("available") else None,
        "processCount": telemetry.get("processes", {}).get("count"),
        "gpuPercent": telemetry.get("gpu", {}).get("usagePercent")
        if telemetry.get("gpu", {}).get("available")
        else None,
    }


def _format_telemetry_prompt(telemetry: dict, bundle: dict, *, include_processes: bool) -> str:
    cpu = telemetry.get("cpu", {})
    mem = telemetry.get("memory", {})
    disk = telemetry.get("disk", {})
    bat = telemetry.get("battery", {})
    gpu = telemetry.get("gpu", {})
    health = bundle.get("health", {})
    perf = bundle.get("performance", {})
    mem_a = bundle.get("memory", {})

    bat_line = "n/a"
    if bat.get("available"):
        bat_line = f"{bat.get('percent')}% charging={bat.get('charging')}"

    gpu_line = "n/a"
    if gpu.get("available"):
        gpu_line = f"{gpu.get('usagePercent')}% ({gpu.get('name') or 'GPU'})"

    lines = [
        f"CPU: {cpu.get('usagePercent')}% ({cpu.get('coreCount')} cores)",
        f"RAM: {mem.get('usagePercent')}% used ({_format_bytes(int(mem.get('usedBytes', 0)))} / {_format_bytes(int(mem.get('totalBytes', 0)))})",
        f"Disk: {disk.get('usagePercent')}% used ({_format_bytes(int(disk.get('freeBytes', 0)))} free)",
        f"Battery: {bat_line}",
        f"GPU: {gpu_line}",
        f"Health score: {health.get('score')}/100 ({health.get('performance')})",
        f"Analysis: {perf.get('summary')} | {mem_a.get('summary')}",
        f"Issues: {', '.join(health.get('detectedIssues') or []) or 'none'}",
    ]

    if include_processes:
        procs = telemetry.get("processes", {}).get("items") or []
        mem_top = mem.get("topProcesses") or []
        cpu_top = sorted(procs, key=lambda p: float(p.get("cpuPercent", 0)), reverse=True)[:3]
        ram_top = sorted(procs, key=lambda p: int(p.get("memoryBytes", 0)), reverse=True)[:3]
        if not ram_top and mem_top:
            ram_top = [{"name": p.get("name"), "memoryBytes": p.get("memoryBytes")} for p in mem_top[:3]]
        cpu_lines = [
            f"  - {p.get('name')} ({p.get('cpuPercent')}% CPU)" for p in cpu_top if p.get("name")
        ] or ["  - (none in sample)"]
        ram_lines = [
            f"  - {p.get('name')} ({_format_bytes(int(p.get('memoryBytes', 0)))})"
            for p in ram_top
            if p.get("name")
        ] or ["  - (none in sample)"]
        lines.extend(
            [
                f"Process count: {telemetry.get('processes', {}).get('count')}",
                "Top CPU:",
                *cpu_lines,
                "Top RAM:",
                *ram_lines,
            ]
        )

    return "\n".join(lines)


def _format_rag_block(items: list[dict]) -> str:
    if not items:
        return "No matching indexed documents."
    lines = []
    for item in items:
        lines.append(
            f"- {item.get('fileName')} (similarity {item.get('similarity')}): "
            f"{item.get('snippet', '')[:RAG_SNIPPET_CHARS]}"
        )
    return "\n".join(lines)


def _format_index_context(doc_stats: dict, embed_stats: dict) -> str:
    return (
        f"Indexed: {doc_stats.get('totalIndexed', 0)} | Pending: {doc_stats.get('totalPending', 0)} | "
        f"Failed: {doc_stats.get('totalFailed', 0)} | Embeddings pending: "
        f"{embed_stats.get('documentsPending', 0)} | Vector chunks: {embed_stats.get('vectorChunks', 0)}"
    )


def _format_recommendations(recs: list[dict]) -> str:
    if not recs:
        return "No proactive alerts."
    return "\n".join(
        f"- [{rec.get('severity')}] {rec.get('title')}: {rec.get('action')}" for rec in recs[:5]
    )


def _fetch_doc_stats() -> dict:
    db = SessionLocal()
    try:
        return get_cached_doc_stats(lambda: DocumentService(db).stats())
    finally:
        db.close()


def _fetch_embed_stats() -> dict:
    db = SessionLocal()
    try:
        return get_cached_embed_stats(lambda: EmbeddingStatsService(db).compute())
    finally:
        db.close()


def _fetch_rag_items(query: str) -> list[dict]:
    db = SessionLocal()
    try:
        search_query = expand_search_query(query)
        result = SearchService(db).semantic_search(search_query, 1, RAG_TOP_K, None, None)
        return result.get("items") or []
    except Exception as exc:
        logger.warning("Copilot RAG search skipped: %s", exc)
        return []
    finally:
        db.close()


def _fetch_duplicates(*, include_near_filename: bool, include_semantic: bool) -> str:
    db = SessionLocal()
    try:
        return build_duplicates_context(
            db,
            include_near_filename=include_near_filename,
            include_semantic=include_semantic,
        )
    finally:
        db.close()


class CopilotService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._settings = SettingsService(db).get_settings()

    def _provider(self):
        return get_llm_provider(
            self._settings.get("copilotProvider", "ollama"),
            self._settings.get("copilotModel", DEFAULT_COPILOT_MODEL),
            self._settings.get("ollamaBaseUrl", "http://127.0.0.1:11434"),
        )

    def prepare_chat(
        self,
        message: str,
        *,
        history: list[dict[str, str]] | None = None,
    ) -> dict[str, Any]:
        trimmed = message.strip()
        if not trimmed:
            raise ValueError("Message cannot be empty")

        timer = PipelineTimer(label=trimmed[:48])
        intents = classify_intents(trimmed)
        timer.mark("intent")

        telemetry: dict | None = None
        bundle: dict = {}
        doc_stats: dict = {}
        embed_stats: dict = {}
        duplicates_note = ""
        storage_note = ""
        rag_items: list[dict] = []
        recommendations: list[dict] = []

        futures: dict[str, Any] = {}
        with ThreadPoolExecutor(max_workers=3) as pool:
            if intents["telemetry"]:
                include_processes = intents["processes"]

                def _load_telemetry() -> tuple[dict, dict]:
                    snap = get_cached_snapshot(include_processes=include_processes)
                    return snap, build_analysis_bundle(snap)

                futures["telemetry"] = pool.submit(_load_telemetry)
            if intents["indexing"]:
                futures["doc_stats"] = pool.submit(_fetch_doc_stats)
                futures["embed_stats"] = pool.submit(_fetch_embed_stats)
            if intents["rag"]:
                futures["rag"] = pool.submit(_fetch_rag_items, trimmed)
            if intents["duplicates"]:
                futures["duplicates"] = pool.submit(
                    _fetch_duplicates,
                    include_near_filename=True,
                    include_semantic=intents["duplicates_semantic"],
                )

            if "telemetry" in futures:
                telemetry, bundle = futures["telemetry"].result()
                timer.mark("telemetry")
            if intents["storage_health"] or intents["health_report"]:
                disk = (telemetry or get_cached_snapshot(include_processes=False)).get("disk", {})
                disk_key = f"{disk.get('usagePercent')}:{disk.get('freeBytes')}"
                storage_note = get_cached_storage_context(
                    disk_key,
                    lambda: build_storage_context(disk),
                )
                timer.mark("storage")

            if "doc_stats" in futures:
                doc_stats = futures["doc_stats"].result()
                timer.mark("indexStats")
            if "embed_stats" in futures:
                embed_stats = futures["embed_stats"].result()
                timer.mark("embedStats")
            if "rag" in futures:
                rag_items = futures["rag"].result()
                timer.mark("semanticSearch")
            if "duplicates" in futures:
                duplicates_note = futures["duplicates"].result()
                timer.mark("duplicates")

        if intents["recommendations"] and telemetry:
            recommendations = build_recommendations(bundle, embed_stats or {}, duplicates_note)
            timer.mark("recommendations")

        prompt_parts: list[str] = []
        if intents["telemetry"] and telemetry:
            prompt_parts.extend(
                [
                    TELEMETRY_CONTEXT_HEADER,
                    _format_telemetry_prompt(
                        telemetry,
                        bundle,
                        include_processes=intents["processes"],
                    ),
                ]
            )
        if intents["indexing"] and doc_stats:
            prompt_parts.append("Indexing status: " + _format_index_context(doc_stats, embed_stats))
        if intents["recommendations"] and recommendations:
            prompt_parts.append("Recommendations:\n" + _format_recommendations(recommendations))
        if storage_note:
            prompt_parts.append("Storage analysis:\n" + storage_note)
        if duplicates_note:
            prompt_parts.append("Duplicate files:\n" + duplicates_note)
        if intents["rag"]:
            prompt_parts.append("\n".join([RAG_CONTEXT_HEADER, _format_rag_block(rag_items)]))

        prompt_parts.append(f"User question:\n{trimmed}")
        user_prompt = "\n\n".join(prompt_parts) if prompt_parts else trimmed
        timer.mark("promptConstruction")

        use_brief_system = intents["casual"] or intents["general"]
        system_prompt = ORBIT_COPILOT_SYSTEM_BRIEF if use_brief_system else ORBIT_COPILOT_SYSTEM

        profile = timer.finish(extra=f"intents={intents}")

        meta = {
            "systemContext": _compact_context_panel(telemetry) if intents["telemetry"] else {},
            "healthSummary": bundle.get("health") or {
                "score": 0,
                "performance": "Unknown",
                "detectedIssues": [],
                "recommendations": [],
            },
            "documentSearchUsed": intents["rag"],
            "copilotProvider": self._settings.get("copilotProvider", "ollama"),
            "modelUsed": self._settings.get("copilotModel", DEFAULT_COPILOT_MODEL),
            "documentSources": [
                {
                    "documentId": item.get("documentId"),
                    "fileName": item.get("fileName"),
                    "path": item.get("path"),
                    "similarity": item.get("similarity"),
                }
                for item in rag_items
            ],
            "analysis": {
                "performance": bundle.get("performance", {}),
                "memory": bundle.get("memory", {}),
                "processes": bundle.get("processes", {}),
            },
            "recommendations": recommendations,
            "intents": intents,
            "profile": profile,
        }

        return {
            "user_prompt": user_prompt,
            "system_prompt": system_prompt,
            "history": _trim_history(history),
            "meta": meta,
        }

    def chat(
        self,
        message: str,
        *,
        history: list[dict[str, str]] | None = None,
    ) -> dict:
        request_timer = PipelineTimer(label="copilot-request")
        prepared = self.prepare_chat(message, history=history)
        request_timer.mark("contextReady")
        reply = self._provider().complete(
            prepared["system_prompt"],
            prepared["user_prompt"],
            history=prepared["history"],
        )
        request_timer.mark("ollama")
        request_timer.finish(extra=f"model={prepared['meta'].get('modelUsed')}")
        return {
            "reply": reply,
            **prepared["meta"],
        }

    def stream_from_prepared(self, prepared: dict[str, Any]) -> Iterator[dict]:
        llm_timer = PipelineTimer(label="ollama-stream")
        tokens: list[str] = []
        first_token = True
        for token in self._provider().stream_complete(
            prepared["system_prompt"],
            prepared["user_prompt"],
            history=prepared["history"],
        ):
            if first_token:
                llm_timer.mark("ollamaFirstToken")
                first_token = False
            tokens.append(token)
            yield {"type": "token", "content": token}
        llm_timer.mark("ollamaComplete")
        llm_timer.finish(extra=f"tokens={len(tokens)}")
        yield {
            "type": "done",
            "reply": "".join(tokens),
            **prepared["meta"],
        }

    def stream_chat(
        self,
        message: str,
        *,
        history: list[dict[str, str]] | None = None,
    ) -> Iterator[dict]:
        prepared = self.prepare_chat(message, history=history)
        yield from self.stream_from_prepared(prepared)

    def context_snapshot(self) -> dict:
        """Lightweight health/recommendations for the sidebar (no DB or RAG work)."""
        telemetry = get_cached_snapshot(include_processes=False)
        bundle = build_analysis_bundle(telemetry)
        recommendations = build_recommendations(bundle, {}, "")
        return {
            "healthSummary": bundle["health"],
            "recommendations": recommendations[:5],
            "copilotProvider": self._settings.get("copilotProvider", "ollama"),
            "modelUsed": self._settings.get("copilotModel", DEFAULT_COPILOT_MODEL),
        }
