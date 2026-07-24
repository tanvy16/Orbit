"""Benchmark Copilot context preparation for common prompts."""

from __future__ import annotations

import statistics
import time

from backend.ai.copilot import CopilotService
from backend.app.database.session import SessionLocal

PROMPTS = [
    ("hello", "casual"),
    ("Why is my PC slow?", "telemetry"),
    ("Summarize my report", "rag"),
    ("Find duplicate files", "duplicates"),
    ("Analyze disk health", "storage"),
    ("What is my CPU usage?", "direct"),
]

ROUNDS = 3


def bench_prompt(message: str) -> tuple[float, dict]:
    db = SessionLocal()
    try:
        service = CopilotService(db)
        direct = service.try_direct_response(message)
        if direct:
            return 0.0, direct.get("profile", {})
        started = time.perf_counter()
        prepared = service.prepare_chat(message)
        elapsed = (time.perf_counter() - started) * 1000
        return elapsed, prepared.get("meta", {}).get("profile", {})
    finally:
        db.close()


def main() -> None:
    print("Copilot prepare_chat benchmark (ms)")
    print("-" * 72)
    for message, label in PROMPTS:
        samples: list[float] = []
        profile: dict = {}
        for _ in range(ROUNDS):
            elapsed, profile = bench_prompt(message)
            samples.append(elapsed)
        stage_parts = ", ".join(
            f"{key}={value}ms"
            for key, value in profile.items()
            if key.endswith("Delta") and isinstance(value, (int, float))
        )
        print(
            f"{label:12} avg={statistics.mean(samples):6.1f}ms "
            f"min={min(samples):6.1f}ms max={max(samples):6.1f}ms  ({message!r})"
        )
        if stage_parts:
            print(f"             stages: {stage_parts}")


if __name__ == "__main__":
    main()
