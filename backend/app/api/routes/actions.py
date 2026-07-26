from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.actions.action_executor import execute_action_plan, plan_from_dict
from backend.actions.file_actions import enrich_action_plan
from backend.actions.types import ActionPlan
from backend.app.database.session import get_db
from backend.app.services.desktop_bridge import DesktopBridgeError

router = APIRouter(prefix="/actions", tags=["actions"])


class ExecuteActionRequest(BaseModel):
    plan: dict = Field(description="Desktop action plan payload")
    userCommand: str = Field(default="", max_length=4000)
    force: bool = False


class ChooseFileRequest(BaseModel):
    plan: dict
    path: str = Field(min_length=1, max_length=2048)
    fileName: str | None = None
    userCommand: str = Field(default="", max_length=4000)


@router.post(
    "/execute",
    summary="Execute a desktop action plan",
    description="Runs a desktop action through the Electron bridge and returns the real result.",
)
def execute_action(payload: ExecuteActionRequest, db: Session = Depends(get_db)) -> dict:
    plan = plan_from_dict(payload.plan)
    if payload.force:
        plan.requires_confirmation = False
        plan.status = "pending"
    try:
        plan = enrich_action_plan(db, plan)
        result = execute_action_plan(
            db,
            plan,
            user_command=payload.userCommand,
            force=payload.force,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except DesktopBridgeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"ok": bool(result.get("ok")), "result": result, "plan": plan.to_dict()}


@router.post(
    "/choose",
    summary="Open a selected file candidate",
    description="Executes an open_file action for a user-selected candidate.",
)
def choose_file(payload: ChooseFileRequest, db: Session = Depends(get_db)) -> dict:
    base = plan_from_dict(payload.plan)
    plan = ActionPlan(
        action_type="open_file",
        params={
            **base.params,
            "path": payload.path,
            "fileName": payload.fileName,
        },
        action_id=base.action_id,
        status="pending",
        requires_confirmation=False,
        log_message=base.log_message,
    )
    try:
        result = execute_action_plan(db, plan, user_command=payload.userCommand, force=True)
    except DesktopBridgeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"ok": bool(result.get("ok")), "result": result, "plan": plan.to_dict()}
