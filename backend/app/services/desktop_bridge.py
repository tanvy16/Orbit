from __future__ import annotations

import time
from typing import Any

import httpx

from backend.app.core.config import settings
from backend.app.core.logging import logger


class DesktopBridgeError(RuntimeError):
    """Raised when the Electron desktop bridge is unavailable or rejects an action."""


def execute_desktop_plan(plan: dict[str, Any], *, timeout_seconds: float = 30.0) -> dict[str, Any]:
    """Execute a desktop action plan via the Electron main-process bridge."""
    url = f"{settings.orbit_desktop_bridge_url.rstrip('/')}/execute"
    started = time.perf_counter()
    try:
        with httpx.Client(timeout=timeout_seconds) as client:
            response = client.post(url, json=plan)
    except httpx.ConnectError as exc:
        raise DesktopBridgeError(
            "Orbit desktop bridge is not running. Launch the Orbit desktop app to execute actions."
        ) from exc
    except httpx.TimeoutException as exc:
        raise DesktopBridgeError("Desktop action timed out waiting for Electron.") from exc
    except httpx.HTTPError as exc:
        raise DesktopBridgeError(f"Desktop bridge request failed: {exc}") from exc

    elapsed_ms = (time.perf_counter() - started) * 1000
    try:
        payload = response.json()
    except ValueError as exc:
        raise DesktopBridgeError(f"Desktop bridge returned invalid JSON ({response.status_code})") from exc

    if not isinstance(payload, dict):
        raise DesktopBridgeError("Desktop bridge returned an unexpected response.")

    payload.setdefault("executionTimeMs", elapsed_ms)
    if response.status_code >= 400 and payload.get("ok") is not False:
        payload["ok"] = False
        payload.setdefault("message", f"Desktop bridge error ({response.status_code})")
    return payload


def bridge_health() -> dict[str, Any]:
    url = f"{settings.orbit_desktop_bridge_url.rstrip('/')}/health"
    try:
        with httpx.Client(timeout=2.0) as client:
            response = client.get(url)
            response.raise_for_status()
            return response.json()
    except Exception as exc:
        logger.debug("Desktop bridge health check failed: %s", exc)
        return {"ok": False, "error": str(exc)}
