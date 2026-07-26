from __future__ import annotations



from collections.abc import Iterator

from concurrent.futures import ThreadPoolExecutor

from typing import Any



from sqlalchemy.orm import Session



from backend.ai.analyzer import build_analysis_bundle

from backend.ai.copilot_cache import (

    get_cached_analysis_bundle,

    get_cached_doc_stats,

    get_cached_duplicates_context,

    get_cached_embed_stats,

    get_cached_rag_items,

    get_cached_storage_context,

)

from backend.ai.duplicates_intel import build_duplicates_context

from backend.ai.fuzzy import extract_rag_query

from backend.ai.direct import try_direct_response as resolve_direct_response

from backend.ai.intent import classify_intents

from backend.ai.perf import (

    STAGE_CONTEXT,

    STAGE_DUPLICATES,

    STAGE_LLM,

    STAGE_RAG,

    STAGE_STORAGE,

    STAGE_TELEMETRY,

    PipelineTimer,

)

from backend.ai.prompts import (

    ORBIT_COPILOT_SYSTEM,

    ORBIT_COPILOT_SYSTEM_BRIEF,

    ORBIT_COPILOT_SYSTEM_COMPACT,

    RAG_CONTEXT_HEADER,

    TELEMETRY_CONTEXT_HEADER,

)

from backend.ai.recommendations import build_recommendations

from backend.ai.storage_intel import build_storage_context

from backend.app.core.logging import logger

from backend.app.database.session import SessionLocal

from backend.app.services.document_service import DocumentService

from backend.app.core.ai_config import MAX_HISTORY_MESSAGES as AI_MAX_HISTORY_MESSAGES

from backend.app.services.llm_providers import DEFAULT_COPILOT_MODEL, get_llm_provider

from backend.app.services.search_service import EmbeddingStatsService, SearchService

from backend.app.services.settings_service import SettingsService

from backend.monitoring.cache import get_cached_snapshot

from backend.observability.copilot_logging import record_copilot_outcome



MAX_HISTORY_MESSAGES = AI_MAX_HISTORY_MESSAGES

RAG_TOP_K = 3

RAG_SNIPPET_CHARS = 150

CONTEXT_POOL_WORKERS = 5





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





def _format_telemetry_prompt(

    telemetry: dict,

    bundle: dict,

    *,

    include_processes: bool,

    compact: bool,

) -> str:

    cpu = telemetry.get("cpu", {})

    mem = telemetry.get("memory", {})

    disk = telemetry.get("disk", {})

    perf = bundle.get("performance", {})

    mem_a = bundle.get("memory", {})

    health = bundle.get("health", {})



    if compact:

        lines = [

            f"CPU {cpu.get('usagePercent')}% | RAM {mem.get('usagePercent')}% "

            f"({_format_bytes(int(mem.get('usedBytes', 0)))} used) | "

            f"Disk {disk.get('usagePercent')}% ({_format_bytes(int(disk.get('freeBytes', 0)))} free)",

            f"Health {health.get('score')}/100 ({health.get('performance')}) | {perf.get('summary')} | {mem_a.get('summary')}",

        ]

        if include_processes:

            procs = telemetry.get("processes", {}).get("items") or []

            cpu_top = sorted(procs, key=lambda p: float(p.get("cpuPercent", 0)), reverse=True)[:3]

            ram_top = sorted(procs, key=lambda p: int(p.get("memoryBytes", 0)), reverse=True)[:3]

            if cpu_top:

                lines.append(

                    "Top CPU: "

                    + ", ".join(f"{p.get('name')} {p.get('cpuPercent')}%" for p in cpu_top if p.get("name"))

                )

            if ram_top:

                lines.append(

                    "Top RAM: "

                    + ", ".join(

                        f"{p.get('name')} {_format_bytes(int(p.get('memoryBytes', 0)))}"

                        for p in ram_top

                        if p.get("name")

                    )

                )

        return "\n".join(lines)



    bat = telemetry.get("battery", {})

    gpu = telemetry.get("gpu", {})

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

            f"- {item.get('fileName')} ({item.get('similarity')}): "

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

        f"- [{rec.get('severity')}] {rec.get('title')}: {rec.get('action')}" for rec in recs[:3]

    )





def _analysis_cache_key(snapshot: dict, *, include_processes: bool, include_temperatures: bool) -> str:

    return f"{snapshot.get('timestamp')}:{include_processes}:{include_temperatures}"





def _load_telemetry(*, include_processes: bool, include_temperatures: bool) -> tuple[dict, dict]:

    snap = get_cached_snapshot(include_processes=include_processes)

    cache_key = _analysis_cache_key(

        snap,

        include_processes=include_processes,

        include_temperatures=include_temperatures,

    )

    bundle = get_cached_analysis_bundle(

        cache_key,

        lambda: build_analysis_bundle(snap, include_temperatures=include_temperatures),

    )

    return snap, bundle





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





def _fetch_rag_items_uncached(query: str) -> list[dict]:

    db = SessionLocal()

    try:

        search_query = extract_rag_query(query)

        result = SearchService(db).semantic_search(search_query, 1, RAG_TOP_K, None, None)

        return result.get("items") or []

    except Exception as exc:

        logger.warning("Copilot RAG search skipped: %s", exc)

        return []

    finally:

        db.close()





def _fetch_rag_items(query: str) -> list[dict]:

    search_query = extract_rag_query(query)

    return get_cached_rag_items(search_query, lambda: _fetch_rag_items_uncached(query))





def _fetch_duplicates_uncached(*, include_near_filename: bool, include_semantic: bool) -> str:

    db = SessionLocal()

    try:

        return build_duplicates_context(

            db,

            include_near_filename=include_near_filename,

            include_semantic=include_semantic,

        )

    finally:

        db.close()





def _fetch_duplicates(*, include_near_filename: bool, include_semantic: bool) -> str:

    cache_key = f"near={include_near_filename}:semantic={include_semantic}"

    return get_cached_duplicates_context(

        cache_key,

        lambda: _fetch_duplicates_uncached(

            include_near_filename=include_near_filename,

            include_semantic=include_semantic,

        ),

    )





def _fetch_storage_note() -> str:

    disk = get_cached_snapshot(include_processes=False).get("disk", {})

    disk_key = f"{disk.get('usagePercent')}:{disk.get('freeBytes')}"

    return get_cached_storage_context(disk_key, lambda: build_storage_context(disk))





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



    def try_casual_response(self, message: str) -> dict | None:
        from backend.ai.casual import try_casual_response as resolve_casual

        return resolve_casual(message)

    def try_direct_response(self, message: str) -> dict | None:

        return resolve_direct_response(self.db, message)



    def try_action_response(self, message: str) -> dict | None:

        from backend.actions.action_executor import try_action_response as resolve_action_response

        return resolve_action_response(self.db, message)



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

        if intents.get("direct_answer"):

            if intents.get("desktop_action"):

                raise ValueError("Desktop actions must use try_action_response()")

            raise ValueError("Direct answers must use try_direct_response()")

        timer.mark("intent")



        telemetry: dict | None = None

        bundle: dict = {}

        doc_stats: dict = {}

        embed_stats: dict = {}

        duplicates_note = ""

        storage_note = ""

        rag_items: list[dict] = []

        recommendations: list[dict] = []



        context_started = timer._last

        futures: dict[str, Any] = {}

        with ThreadPoolExecutor(max_workers=CONTEXT_POOL_WORKERS) as pool:

            if intents["telemetry"]:

                futures[STAGE_TELEMETRY] = pool.submit(

                    _load_telemetry,

                    include_processes=bool(intents["processes"]),

                    include_temperatures=bool(intents["health_report"]),

                )

            if intents["indexing"]:

                futures["indexStats"] = pool.submit(_fetch_doc_stats)

                futures["embedStats"] = pool.submit(_fetch_embed_stats)

            if intents["rag"]:

                futures[STAGE_RAG] = pool.submit(_fetch_rag_items, trimmed)

            if intents["duplicates"]:

                futures[STAGE_DUPLICATES] = pool.submit(

                    _fetch_duplicates,

                    include_near_filename=True,

                    include_semantic=bool(intents["duplicates_semantic"]),

                )

            if intents["storage_health"]:

                futures[STAGE_STORAGE] = pool.submit(_fetch_storage_note)



            for key, future in futures.items():

                try:

                    result = future.result()

                except Exception as exc:

                    logger.warning("Copilot context task %s failed: %s", key, exc)

                    continue



                if key == STAGE_TELEMETRY:

                    telemetry, bundle = result

                    timer.mark(STAGE_TELEMETRY)

                elif key == "indexStats":

                    doc_stats = result

                    timer.mark("indexStats")

                elif key == "embedStats":

                    embed_stats = result

                    timer.mark("embedStats")

                elif key == STAGE_RAG:

                    rag_items = result

                    timer.mark(STAGE_RAG)

                elif key == STAGE_DUPLICATES:

                    duplicates_note = result

                    timer.mark(STAGE_DUPLICATES)

                elif key == STAGE_STORAGE:

                    storage_note = result

                    timer.mark(STAGE_STORAGE)



        if intents["recommendations"] and telemetry:

            recommendations = build_recommendations(bundle, embed_stats or {}, duplicates_note)

            timer.mark("recommendations")



        context_ms = round((timer._last - context_started) * 1000, 1)

        timer._marks[STAGE_CONTEXT] = context_ms

        timer._deltas[STAGE_CONTEXT] = context_ms

        logger.info(

            "Copilot stage [%s] %s: %sms (+%sms)",

            timer.label,

            STAGE_CONTEXT,

            context_ms,

            context_ms,

        )



        use_compact_telemetry = bool(intents["telemetry"]) and not intents["health_report"]

        prompt_parts: list[str] = []

        if intents["telemetry"] and telemetry:

            prompt_parts.extend(

                [

                    TELEMETRY_CONTEXT_HEADER,

                    _format_telemetry_prompt(

                        telemetry,

                        bundle,

                        include_processes=bool(intents["processes"]),

                        compact=use_compact_telemetry,

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



        if intents["casual"] or intents["general"]:

            system_prompt = ORBIT_COPILOT_SYSTEM_BRIEF

        elif intents["health_report"] or intents["storage_health"] or intents["duplicates"]:

            system_prompt = ORBIT_COPILOT_SYSTEM

        else:

            system_prompt = ORBIT_COPILOT_SYSTEM_COMPACT



        profile = timer.finish(extra=f"intents={intents} promptChars={len(user_prompt)}")



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

            "directAnswer": False,

            "userMessage": trimmed,

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

        direct = self.try_direct_response(message)

        if direct:

            request_timer.mark("directAnswer")

            request_timer.finish(extra="mode=direct")

            record_copilot_outcome(self.db, message=message, response=direct, route="direct")

            return direct



        action = self.try_action_response(message)

        if action:

            request_timer.mark("desktopAction")

            request_timer.finish(extra="mode=desktop_action")

            record_copilot_outcome(self.db, message=message, response=action, route="desktop_action")

            return action

        casual = self.try_casual_response(message)

        if casual:

            request_timer.mark("casualFastPath")

            request_timer.finish(extra="mode=casual")

            record_copilot_outcome(self.db, message=message, response=casual, route="casual")

            return casual



        prepared = self.prepare_chat(message, history=history)

        request_timer.mark("contextReady")

        reply = self._provider().complete(

            prepared["system_prompt"],

            prepared["user_prompt"],

            history=prepared["history"],

        )

        request_timer.mark(STAGE_LLM)

        request_timer.finish(extra=f"model={prepared['meta'].get('modelUsed')}")

        result = {

            "reply": reply,

            **prepared["meta"],

        }

        record_copilot_outcome(self.db, message=message, response=result, route="chat")

        return result



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

        llm_timer.mark(STAGE_LLM)

        llm_timer.finish(extra=f"tokens={len(tokens)}")

        done_payload = {

            "type": "done",

            "reply": "".join(tokens),

            **prepared["meta"],

        }

        record_copilot_outcome(

            self.db,

            message=prepared["meta"].get("userMessage") or prepared["user_prompt"][:120],

            response=done_payload,

            route="chat_stream",

        )

        yield done_payload



    def context_snapshot(self) -> dict:

        """Lightweight health/recommendations for the sidebar (no DB or RAG work)."""

        telemetry = get_cached_snapshot(include_processes=False)

        bundle = get_cached_analysis_bundle(

            _analysis_cache_key(telemetry, include_processes=False, include_temperatures=False),

            lambda: build_analysis_bundle(telemetry, include_temperatures=False),

        )

        recommendations = build_recommendations(bundle, {}, "")

        return {

            "healthSummary": bundle["health"],

            "recommendations": recommendations[:5],

            "copilotProvider": self._settings.get("copilotProvider", "ollama"),

            "modelUsed": self._settings.get("copilotModel", DEFAULT_COPILOT_MODEL),

        }


