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
        "implemented": False,
        "phase": 3,
        "message": "AI Copilot will invoke orchestrated tools over indexed documents.",
    }


@router.get("/rag")
def rag_stub() -> dict:
    return {"implemented": False, "phase": 3, "message": "RAG pipeline reserved for Phase 3."}


@router.get("/monitoring")
def monitoring_stub() -> dict:
    return {"implemented": False, "phase": 4, "message": "System monitoring stream reserved."}


@router.get("/analytics")
def analytics_stub() -> dict:
    return {"implemented": False, "phase": 4, "message": "Historical analytics reserved."}


@router.get("/automation")
def automation_stub() -> dict:
    return {"implemented": False, "phase": 4, "message": "Workflow automation reserved."}
