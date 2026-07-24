from fastapi import APIRouter

router = APIRouter(prefix="/extensions", tags=["extensions"])


@router.get("/semantic-search")
def semantic_search_stub() -> dict:
    return {
        "implemented": True,
        "phase": 3,
        "endpoint": "/api/v1/search/semantic",
    }


@router.get("/ai-copilot")
def ai_copilot_stub() -> dict:
    return {
        "implemented": True,
        "phase": 4,
        "endpoints": {
            "chat": "/api/v1/copilot/chat",
            "chatStream": "/api/v1/copilot/chat/stream",
            "context": "/api/v1/copilot/context",
            "ollamaModels": "/api/v1/ollama/models",
        },
    }


@router.get("/rag")
def rag_stub() -> dict:
    return {
        "implemented": True,
        "phase": 3,
        "endpoint": "/api/v1/search/semantic",
        "copilotIntegration": True,
    }


@router.get("/monitoring")
def monitoring_stub() -> dict:
    return {
        "implemented": True,
        "phase": 4,
        "endpoints": {
            "snapshot": "/api/v1/monitoring/snapshot",
            "websocket": "/api/v1/monitoring/ws",
        },
    }


@router.get("/analytics")
def analytics_stub() -> dict:
    return {"implemented": False, "phase": 4, "message": "Historical analytics reserved."}


@router.get("/automation")
def automation_stub() -> dict:
    return {"implemented": False, "phase": 4, "message": "Workflow automation reserved."}
