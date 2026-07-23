from __future__ import annotations

import asyncio
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import TypeVar

from backend.app.core.logging import logger

T = TypeVar("T")

# CPU-bound work (embeddings, model load) off the FastAPI event loop.
_cpu_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="orbit-cpu")


async def run_cpu_bound(func: Callable[[], T], *, timeout_seconds: float = 120.0) -> T:
    loop = asyncio.get_running_loop()
    try:
        return await asyncio.wait_for(
            loop.run_in_executor(_cpu_executor, func),
            timeout=timeout_seconds,
        )
    except asyncio.TimeoutError as exc:
        logger.error("CPU-bound task timed out after %ss", timeout_seconds)
        raise TimeoutError(f"Operation timed out after {timeout_seconds}s") from exc
