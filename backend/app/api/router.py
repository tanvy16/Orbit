from fastapi import APIRouter

from backend.app.api.routes import (
    documents,
    embeddings,
    extensions,
    folders,
    health,
    monitoring,
    notifications,
    search,
    settings,
    tasks,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(documents.router)
api_router.include_router(folders.router)
api_router.include_router(settings.router)
api_router.include_router(notifications.router)
api_router.include_router(tasks.router)
api_router.include_router(search.router)
api_router.include_router(embeddings.router)
api_router.include_router(extensions.router)
api_router.include_router(monitoring.router)
