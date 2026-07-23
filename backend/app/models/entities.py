from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.models.base import Base, TimestampMixin


class AppSetting(Base, TimestampMixin):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    value: Mapped[str] = mapped_column(Text, default="{}")


class WatchedFolder(Base, TimestampMixin):
    __tablename__ = "watched_folders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    path: Mapped[str] = mapped_column(String(1024), unique=True, index=True)
    label: Mapped[str] = mapped_column(String(256), default="")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_scan_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class IndexedFile(Base, TimestampMixin):
    __tablename__ = "indexed_files"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    path: Mapped[str] = mapped_column(String(1024), unique=True, index=True)
    file_name: Mapped[str] = mapped_column(String(512), default="", index=True)
    extension: Mapped[str] = mapped_column(String(32), default="", index=True)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    modified_at: Mapped[str] = mapped_column(String(64), default="")
    content_hash: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    mime_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    index_status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    watched_folder_id: Mapped[int | None] = mapped_column(
        ForeignKey("watched_folders.id"), nullable=True, index=True
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    duplicate_of_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    content_preview: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")

    watched_folder: Mapped["WatchedFolder | None"] = relationship("WatchedFolder")


class BackgroundTask(Base, TimestampMixin):
    __tablename__ = "background_tasks"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    task_type: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(32), default="queued", index=True)
    progress_percent: Mapped[float] = mapped_column(Float, default=0)
    current_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    stats_json: Mapped[str] = mapped_column(Text, default="{}")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AiConversation(Base, TimestampMixin):
    __tablename__ = "ai_conversations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(256), default="New conversation")
    messages_json: Mapped[str] = mapped_column(Text, default="[]")


class HistoricalMetric(Base, TimestampMixin):
    __tablename__ = "historical_metrics"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    metric_key: Mapped[str] = mapped_column(String(128), index=True)
    value: Mapped[float] = mapped_column()
    recorded_at: Mapped[str] = mapped_column(String(64))


class AutomationHistory(Base, TimestampMixin):
    __tablename__ = "automation_history"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    workflow_id: Mapped[str] = mapped_column(String(128), index=True)
    status: Mapped[str] = mapped_column(String(64), default="pending")
    result_json: Mapped[str] = mapped_column(Text, default="{}")


class NotificationRecord(Base, TimestampMixin):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(256))
    body: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(64), default="general", index=True)
    level: Mapped[str] = mapped_column(String(16), default="info")
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    meta_json: Mapped[str] = mapped_column(Text, default="{}")
