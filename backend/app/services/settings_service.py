from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.api.schemas import SettingsUpdate
from backend.app.core.indexing_config import SETTINGS_KEY
from backend.app.models.entities import AppSetting
from backend.app.services.metadata_extractor import DEFAULT_SETTINGS, merge_settings


class SettingsService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_settings(self) -> dict:
        row = self.db.scalar(select(AppSetting).where(AppSetting.key == SETTINGS_KEY))
        if not row:
            return merge_settings(None)
        try:
            return merge_settings(json.loads(row.value))
        except json.JSONDecodeError:
            return merge_settings(None)

    def update_settings(self, payload: SettingsUpdate) -> dict:
        current = self.get_settings()
        data = payload.model_dump(exclude_unset=True)
        for key, value in data.items():
            if key == "notifications" and isinstance(value, dict):
                current["notifications"] = {**current["notifications"], **value}
            else:
                current[key] = value
        row = self.db.scalar(select(AppSetting).where(AppSetting.key == SETTINGS_KEY))
        if not row:
            row = AppSetting(key=SETTINGS_KEY, value=json.dumps(current))
            self.db.add(row)
        else:
            row.value = json.dumps(current)
        self.db.commit()
        return current

    def maintenance(self, prune_removed: bool, recompute_duplicates: bool) -> dict:
        from backend.app.models.entities import IndexedFile
        from backend.app.services.document_service import DocumentService

        removed = 0
        if prune_removed:
            stale = self.db.scalars(
                select(IndexedFile).where(IndexedFile.index_status == "removed")
            ).all()
            for row in stale:
                self.db.delete(row)
                removed += 1
            self.db.commit()
        if recompute_duplicates:
            DocumentService(self.db).recompute_duplicates()
        return {"prunedRemovedRecords": removed, "duplicatesRecomputed": recompute_duplicates}
