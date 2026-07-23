from __future__ import annotations

import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.monitoring.aggregator import collect_snapshot

router = APIRouter(prefix="/monitoring", tags=["monitoring"])

_STREAM_INTERVAL_SEC = 1.5


@router.get("/snapshot")
def monitoring_snapshot() -> dict:
    return collect_snapshot()


@router.websocket("/ws")
async def monitoring_stream(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            payload = await asyncio.to_thread(collect_snapshot)
            await websocket.send_json(payload)
            await asyncio.sleep(_STREAM_INTERVAL_SEC)
    except WebSocketDisconnect:
        return
    except Exception:
        await websocket.close()
