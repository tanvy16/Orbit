from __future__ import annotations

import asyncio

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from backend.monitoring.aggregator import collect_snapshot
from backend.monitoring.cache import get_cached_snapshot

router = APIRouter(prefix="/monitoring", tags=["monitoring"])

_STREAM_INTERVAL_SEC = 2.5


@router.get("/snapshot")
def monitoring_snapshot(includeProcesses: bool = Query(default=True)) -> dict:
    return get_cached_snapshot(include_processes=includeProcesses)


@router.websocket("/ws")
async def monitoring_stream(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            payload = await asyncio.to_thread(get_cached_snapshot, include_processes=True)
            await websocket.send_json(payload)
            await asyncio.sleep(_STREAM_INTERVAL_SEC)
    except WebSocketDisconnect:
        return
    except Exception:
        await websocket.close()
