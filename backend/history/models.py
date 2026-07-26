from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.models.base import Base, TimestampMixin


class ActionHistoryRecord(Base, TimestampMixin):
    """Persistent log of Copilot and Automation desktop action executions."""

    __tablename__ = "action_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    action_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_command: Mapped[str] = mapped_column(Text, default="")
    detected_intent: Mapped[str] = mapped_column(String(128), index=True, default="unknown")
    action_type: Mapped[str] = mapped_column(String(64), index=True, default="unknown")
    parameters_json: Mapped[str] = mapped_column(Text, default="{}")
    execution_status: Mapped[str] = mapped_column(String(32), index=True, default="pending")
    execution_time_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(32), index=True, default="copilot")
    executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    @property
    def timestamp(self) -> datetime | None:
        return self.executed_at or self.created_at
