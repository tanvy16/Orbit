from __future__ import annotations

import json
from typing import Any

from sqlalchemy import inspect, text

from backend.app.core.logging import logger
from backend.app.database.session import engine
from backend.app.models.base import Base


def _column_names(table: str) -> set[str]:
    with engine.connect() as conn:
        rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return {row[1] for row in rows}


def _add_column_if_missing(table: str, column: str, ddl: str) -> None:
    if column in _column_names(table):
        return
    with engine.begin() as conn:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {ddl}"))
    logger.info("Migration: added %s.%s", table, column)


def run_migrations() -> None:
    """Lightweight SQLite migrations for dev/prod without Alembic (Phase 2)."""
    inspector = inspect(engine)
    existing = set(inspector.get_table_names())

    Base.metadata.create_all(bind=engine)

    if "indexed_files" in existing or "indexed_files" in inspector.get_table_names():
        migrations = [
            ("file_name", "file_name VARCHAR(512)"),
            ("extension", "extension VARCHAR(32)"),
            ("size_bytes", "size_bytes INTEGER DEFAULT 0"),
            ("modified_at", "modified_at VARCHAR(64)"),
            ("mime_type", "mime_type VARCHAR(128)"),
            ("index_status", "index_status VARCHAR(32) DEFAULT 'pending'"),
            ("watched_folder_id", "watched_folder_id INTEGER"),
            ("error_message", "error_message TEXT"),
            ("duplicate_of_id", "duplicate_of_id INTEGER"),
            ("content_preview", "content_preview TEXT"),
        ]
        for col, ddl in migrations:
            _add_column_if_missing("indexed_files", col, ddl)

    if "notifications" in inspector.get_table_names():
        for col, ddl in [
            ("category", "category VARCHAR(64) DEFAULT 'general'"),
            ("level", "level VARCHAR(16) DEFAULT 'info'"),
            ("meta_json", "meta_json TEXT DEFAULT '{}'"),
        ]:
            _add_column_if_missing("notifications", col, ddl)

    logger.info("Database migrations applied")
