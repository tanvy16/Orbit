from __future__ import annotations

import time
from dataclasses import dataclass, field

from backend.app.core.logging import logger


@dataclass
class PipelineTimer:
    """Measure Copilot pipeline stages with cumulative and delta timings."""

    label: str = "copilot"
    _started: float = field(default_factory=time.perf_counter)
    _last: float = field(default_factory=time.perf_counter)
    _marks: dict[str, float] = field(default_factory=dict)
    _deltas: dict[str, float] = field(default_factory=dict)

    def mark(self, stage: str) -> None:
        now = time.perf_counter()
        self._marks[stage] = round((now - self._started) * 1000, 1)
        self._deltas[stage] = round((now - self._last) * 1000, 1)
        self._last = now

    def finish(self, *, extra: str = "") -> dict[str, float]:
        total_ms = round((time.perf_counter() - self._started) * 1000, 1)
        self._marks["totalMs"] = total_ms
        delta_parts = ", ".join(f"{key}={value}ms" for key, value in self._deltas.items())
        suffix = f" {extra}" if extra else ""
        logger.info(
            "Copilot pipeline [%s]: total=%sms | %s%s",
            self.label,
            total_ms,
            delta_parts,
            suffix,
        )
        return {**self._marks, **{f"{k}Delta": v for k, v in self._deltas.items()}}
