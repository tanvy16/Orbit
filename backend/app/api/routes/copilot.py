from __future__ import annotations

import asyncio
import json
import queue
import threading

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.ai.copilot import CopilotService
from backend.app.api.schemas import CopilotChatRequest, CopilotChatResponse
from backend.app.database.session import SessionLocal, get_db
from backend.app.services.async_runner import run_cpu_bound
from backend.app.services.llm_providers import DEFAULT_COPILOT_MODEL, get_llm_provider
from backend.app.services.settings_service import SettingsService
from backend.observability.copilot_logging import record_copilot_outcome

router = APIRouter(prefix="/copilot", tags=["copilot"])

_CLIPBOARD_PROMPTS = {
    "explain": "Explain the following clipboard text clearly and concisely:\n\n{content}",
    "summarize": "Summarize the following clipboard text in a few bullet points:\n\n{content}",
    "translate": "Translate the following clipboard text to English (if already English, polish it):\n\n{content}",
    "improve": "Improve the writing quality of the following clipboard text while preserving meaning:\n\n{content}",
}


class ClipboardProcessRequest(BaseModel):
    operation: str = Field(pattern="^(explain|summarize|translate|improve)$")
    content: str = Field(min_length=1, max_length=12000)


@router.get("/context")
def copilot_context(db: Session = Depends(get_db)) -> dict:
    return CopilotService(db).context_snapshot()


@router.post("/chat", response_model=CopilotChatResponse)
async def copilot_chat(payload: CopilotChatRequest, db: Session = Depends(get_db)) -> dict:
    del db

    history = [{"role": item.role, "content": item.content} for item in payload.history]

    def _run() -> dict:
        thread_db = SessionLocal()
        try:
            return CopilotService(thread_db).chat(payload.message, history=history)
        finally:
            thread_db.close()

    try:
        return await run_cpu_bound(_run, timeout_seconds=120.0)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Copilot request failed: {exc}") from exc


@router.post("/clipboard")
async def process_clipboard(payload: ClipboardProcessRequest, db: Session = Depends(get_db)) -> dict:
    del db

    def _run() -> dict:
        thread_db = SessionLocal()
        try:
            settings = SettingsService(thread_db).get_settings()
            provider = get_llm_provider(
                settings.get("copilotProvider", "ollama"),
                settings.get("copilotModel", DEFAULT_COPILOT_MODEL),
                settings.get("ollamaBaseUrl", "http://127.0.0.1:11434"),
            )
            prompt = _CLIPBOARD_PROMPTS[payload.operation].format(content=payload.content.strip())
            reply = provider.complete(
                "You are Orbit, a helpful desktop assistant.",
                prompt,
                history=[],
            )
            return {"reply": reply.strip()}
        finally:
            thread_db.close()

    try:
        return await run_cpu_bound(_run, timeout_seconds=90.0)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Clipboard processing failed: {exc}") from exc


@router.post("/chat/stream")
async def copilot_chat_stream(payload: CopilotChatRequest, request: Request) -> StreamingResponse:
    history = [{"role": item.role, "content": item.content} for item in payload.history]

    async def event_generator():
        yield f"data: {json.dumps({'type': 'status', 'content': 'preparing'})}\n\n"

        def _prepare() -> dict:
            thread_db = SessionLocal()
            try:
                service = CopilotService(thread_db)
                direct = service.try_direct_response(payload.message)
                if direct:
                    return {"mode": "direct", "response": direct}
                action = service.try_action_response(payload.message)
                if action:
                    return {"mode": "direct", "response": action}
                casual = service.try_casual_response(payload.message)
                if casual:
                    return {"mode": "direct", "response": casual}
                prepared = service.prepare_chat(payload.message, history=history)
                return {"mode": "llm", "prepared": prepared}
            finally:
                thread_db.close()

        try:
            result = await run_cpu_bound(_prepare, timeout_seconds=90.0)
        except ValueError as exc:
            yield f"data: {json.dumps({'type': 'error', 'detail': str(exc)})}\n\n"
            return
        except TimeoutError as exc:
            yield f"data: {json.dumps({'type': 'error', 'detail': str(exc)})}\n\n"
            return
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'detail': f'Copilot context failed: {exc}'})}\n\n"
            return

        if result["mode"] == "direct":
            response = result["response"]
            yield f"data: {json.dumps({'type': 'ready', 'profile': response.get('profile', {}), 'directAnswer': True})}\n\n"
            yield f"data: {json.dumps({'type': 'done', **response})}\n\n"
            log_db = SessionLocal()
            try:
                record_copilot_outcome(
                    log_db,
                    message=payload.message,
                    response=response,
                    route="chat_stream_direct",
                )
            finally:
                log_db.close()
            return

        prepared = result["prepared"]
        yield f"data: {json.dumps({'type': 'ready', 'profile': prepared.get('meta', {}).get('profile', {})})}\n\n"

        thread_queue: queue.Queue[tuple[str, object]] = queue.Queue()

        def worker() -> None:
            thread_db = SessionLocal()
            try:
                service = CopilotService(thread_db)
                for event in service.stream_from_prepared(prepared):
                    thread_queue.put(("event", event))
            except Exception as exc:
                thread_queue.put(("error", exc))
            finally:
                thread_db.close()
                thread_queue.put(("done", None))

        threading.Thread(target=worker, daemon=True).start()

        # Client disconnect stops SSE delivery; the worker may finish the LLM call in background.
        while True:
            if await request.is_disconnected():
                return
            try:
                kind, data = await asyncio.to_thread(thread_queue.get, True, 0.25)
            except queue.Empty:
                continue
            if kind == "done":
                break
            if kind == "error":
                detail = str(data)
                yield f"data: {json.dumps({'type': 'error', 'detail': detail})}\n\n"
                break
            yield f"data: {json.dumps(data)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
