from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel, Field


class SettingsUpdate(BaseModel):
    ignoredDirectoryNames: list[str] | None = None
    supportedExtensions: list[str] | None = None
    autoIndexOnChange: bool | None = None
    autoIndexOnStartup: bool | None = None
    maxFileSizeMb: int | None = Field(default=None, ge=1, le=500)
    notifications: dict[str, bool] | None = None


class WatchedFolderCreate(BaseModel):
    path: str
    label: str | None = None
    enabled: bool = True


class WatchedFolderUpdate(BaseModel):
    label: str | None = None
    enabled: bool | None = None


class IndexedFileUpsert(BaseModel):
    path: str
    fileName: str
    extension: str
    sizeBytes: int
    modifiedAt: str
    contentHash: str | None = None
    mimeType: str | None = None
    indexStatus: str = "indexed"
    watchedFolderId: int | None = None
    contentPreview: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    errorMessage: str | None = None


class IndexedFileBatchUpsert(BaseModel):
    files: list[IndexedFileUpsert]
    removeMissingPaths: list[str] = Field(default_factory=list)


class TaskCreate(BaseModel):
    id: str
    taskType: str
    status: str = "queued"


class TaskUpdate(BaseModel):
    status: str | None = None
    progressPercent: float | None = None
    currentPath: str | None = None
    stats: dict[str, Any] | None = None
    error: str | None = None


class NotificationCreate(BaseModel):
    title: str
    body: str = ""
    category: str = "general"
    level: str = "info"
    meta: dict[str, Any] = Field(default_factory=dict)


class MaintenanceRequest(BaseModel):
    pruneRemoved: bool = True
    recomputeDuplicateFlags: bool = True
