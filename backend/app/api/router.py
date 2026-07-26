from fastapi import APIRouter

from backend.app.api.routes import (
    actions,
    copilot,
    documents,
    embeddings,
    extensions,
    folders,
    health,
    monitoring,
    notifications,
    ollama,
    search,
    settings,
    tasks,
)
from backend.activity.routes import router as activity_router
from backend.automation.routes import router as automation_router
from backend.observability.routes import router as observability_router
from backend.intelligence.routes import router as intelligence_router
from backend.history.routes import router as history_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(documents.router)
api_router.include_router(folders.router)
api_router.include_router(settings.router)
api_router.include_router(notifications.router)
api_router.include_router(tasks.router)
api_router.include_router(search.router)
api_router.include_router(copilot.router)
api_router.include_router(actions.router)
api_router.include_router(history_router)
api_router.include_router(observability_router)
api_router.include_router(activity_router)
api_router.include_router(automation_router)
api_router.include_router(ollama.router)
api_router.include_router(embeddings.router)
api_router.include_router(extensions.router)
api_router.include_router(monitoring.router)
api_router.include_router(intelligence_router)
