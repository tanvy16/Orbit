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
]

ROUNDS = 3


def bench_prompt(message: str) -> float:
    db = SessionLocal()
    try:
        service = CopilotService(db)
        started = time.perf_counter()
        service.prepare_chat(message)
        return (time.perf_counter() - started) * 1000
    finally:
        db.close()


def main() -> None:
    print("Copilot prepare_chat benchmark (ms)")
    print("-" * 52)
    for message, label in PROMPTS:
        samples = [bench_prompt(message) for _ in range(ROUNDS)]
        print(
            f"{label:12} avg={statistics.mean(samples):6.1f}ms "
            f"min={min(samples):6.1f}ms max={max(samples):6.1f}ms  ({message!r})"
        )


if __name__ == "__main__":
    main()
