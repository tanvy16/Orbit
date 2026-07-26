from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.database.session import get_db
from backend.automation.workflow_engine import WorkflowService
from backend.automation.workflow_parser import parse_workflow_description
router = APIRouter(prefix="/automation", tags=["automation"])


class ParseWorkflowRequest(BaseModel):
    description: str = Field(min_length=3, max_length=4000)


class SaveWorkflowRequest(BaseModel):
    name: str = Field(min_length=1, max_length=256)
    description: str = Field(default="", max_length=4000)
    steps: list[dict] = Field(min_length=1)


class UpdateWorkflowRequest(BaseModel):
    name: str | None = Field(default=None, max_length=256)
    description: str | None = Field(default=None, max_length=4000)
    steps: list[dict] | None = None


@router.get("/workflows")
def list_workflows(db: Session = Depends(get_db)) -> dict:
    workflows = WorkflowService(db).list_workflows()
    return {"items": [WorkflowService.serialize_workflow(item) for item in workflows]}


@router.post("/workflows/parse")
def parse_workflow(payload: ParseWorkflowRequest) -> dict:
    try:
        return parse_workflow_description(payload.description)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/workflows")
def create_workflow(payload: SaveWorkflowRequest, db: Session = Depends(get_db)) -> dict:
    workflow = WorkflowService(db).create_workflow(
        name=payload.name,
        description=payload.description,
        steps=payload.steps,
    )
    return WorkflowService.serialize_workflow(workflow)


@router.patch("/workflows/{workflow_id}")
def update_workflow(
    workflow_id: int,
    payload: UpdateWorkflowRequest,
    db: Session = Depends(get_db),
) -> dict:
    workflow = WorkflowService(db).update_workflow(
        workflow_id,
        name=payload.name,
        description=payload.description,
        steps=payload.steps,
    )
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return WorkflowService.serialize_workflow(workflow)


@router.delete("/workflows/{workflow_id}")
def delete_workflow(workflow_id: int, db: Session = Depends(get_db)) -> dict:
    if not WorkflowService(db).delete_workflow(workflow_id):
        raise HTTPException(status_code=404, detail="Workflow not found")
    return {"ok": True}


@router.post("/workflows/{workflow_id}/run")
def run_workflow(workflow_id: int, db: Session = Depends(get_db)) -> dict:
    try:
        return WorkflowService(db).run_workflow(workflow_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/workflows/{workflow_id}/run/stream")
def run_workflow_stream(workflow_id: int, db: Session = Depends(get_db)) -> StreamingResponse:
    service = WorkflowService(db)

    def event_generator():
        try:
            for event in service.iter_run_workflow(workflow_id):
                yield f"data: {json.dumps(event)}\n\n"
        except ValueError as exc:
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
