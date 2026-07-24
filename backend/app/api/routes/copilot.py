from __future__ import annotations

import asyncio
import json
import queue
import threading

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from backend.ai.copilot import CopilotService
from backend.app.api.schemas import CopilotChatRequest, CopilotChatResponse
from backend.app.database.session import SessionLocal, get_db
from backend.app.services.async_runner import run_cpu_bound

router = APIRouter(prefix="/copilot", tags=["copilot"])


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
