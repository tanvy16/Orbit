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
    embeddingProvider: str | None = None
    embeddingModel: str | None = None
    ollamaBaseUrl: str | None = None
    chunkSize: int | None = Field(default=None, ge=200, le=4000)
    chunkOverlap: int | None = Field(default=None, ge=0, le=1000)
    autoEmbedOnIndex: bool | None = None
    copilotProvider: str | None = None
    copilotModel: str | None = None


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


class SemanticSearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    page: int = Field(default=1, ge=1)
    pageSize: int = Field(default=10, ge=1, le=50)
    folderId: int | None = None
    extension: str | None = None


class CopilotHistoryMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=8000)


class CopilotChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[CopilotHistoryMessage] = Field(default_factory=list)


class CopilotChatResponse(BaseModel):
    reply: str
    systemContext: dict[str, Any]
    healthSummary: dict[str, Any]
    documentSearchUsed: bool = False
    documentSources: list[dict[str, Any]] = Field(default_factory=list)
    analysis: dict[str, Any] = Field(default_factory=dict)
    recommendations: list[dict[str, Any]] = Field(default_factory=list)
    copilotProvider: str | None = None
    modelUsed: str | None = None
    directAnswer: bool = False
    desktopAction: bool = False
    desktopActionPlan: dict[str, Any] | None = None
    desktopActionResult: dict[str, Any] | None = None
    profile: dict[str, Any] | None = None
