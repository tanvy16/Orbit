from __future__ import annotations

import json
import time
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from backend.actions.action_executor import execute_action_plan
from backend.actions.types import ActionPlan
from backend.app.services.desktop_bridge import DesktopBridgeError
from backend.automation.models import Workflow, WorkflowStep
from backend.history.logger import ActionHistoryLogger
from backend.observability.event_logger import EventLogger


class WorkflowService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_workflows(self) -> list[Workflow]:
        return list(
            self.db.scalars(
                select(Workflow).options(selectinload(Workflow.steps)).order_by(Workflow.updated_at.desc())
            ).all()
        )

    def get_workflow(self, workflow_id: int) -> Workflow | None:
        return self.db.scalar(
            select(Workflow).options(selectinload(Workflow.steps)).where(Workflow.id == workflow_id)
        )

    def create_workflow(self, *, name: str, description: str, steps: list[dict[str, Any]]) -> Workflow:
        workflow = Workflow(name=name.strip(), description=description.strip())
        self.db.add(workflow)
        self.db.flush()
        for index, step in enumerate(steps, start=1):
            self.db.add(
                WorkflowStep(
                    workflow_id=workflow.id,
                    step_number=int(step.get("stepNumber") or index),
                    action_type=str(step.get("actionType") or step.get("action_type") or ""),
                    target=str(step.get("target") or ""),
                    parameters_json=json.dumps(step.get("parameters") or {}),
                    label=str(step.get("label") or step.get("target") or f"Step {index}"),
                )
            )
        self.db.commit()
        return self.get_workflow(workflow.id)  # type: ignore[return-value]

    def delete_workflow(self, workflow_id: int) -> bool:
        workflow = self.get_workflow(workflow_id)
        if not workflow:
            return False
        self.db.delete(workflow)
        self.db.commit()
        return True

    def update_workflow(
        self,
        workflow_id: int,
        *,
        name: str | None = None,
        description: str | None = None,
        steps: list[dict[str, Any]] | None = None,
    ) -> Workflow | None:
        workflow = self.get_workflow(workflow_id)
        if not workflow:
            return None
        if name is not None:
            workflow.name = name.strip()
        if description is not None:
            workflow.description = description.strip()
        if steps is not None:
            for step in list(workflow.steps):
                self.db.delete(step)
            self.db.flush()
            for index, step in enumerate(steps, start=1):
                self.db.add(
                    WorkflowStep(
                        workflow_id=workflow.id,
                        step_number=int(step.get("stepNumber") or index),
                        action_type=str(step.get("actionType") or step.get("action_type") or ""),
                        target=str(step.get("target") or ""),
                        parameters_json=json.dumps(step.get("parameters") or {}),
                        label=str(step.get("label") or step.get("target") or f"Step {index}"),
                    )
                )
        self.db.commit()
        return self.get_workflow(workflow_id)

    def run_workflow(self, workflow_id: int) -> dict[str, Any]:
        events = list(self.iter_run_workflow(workflow_id))
        final = next((event for event in reversed(events) if event.get("type") == "complete"), None)
        if final:
            return final["payload"]
        raise ValueError("Workflow run produced no completion event")

    def iter_run_workflow(self, workflow_id: int):
        workflow = self.get_workflow(workflow_id)
        if not workflow:
            raise ValueError("Workflow not found")

        started = time.perf_counter()
        results: list[dict[str, Any]] = []
        overall_ok = True
        steps = sorted(workflow.steps, key=lambda item: item.step_number)

        yield {
            "type": "workflow",
            "status": "queued",
            "workflowId": workflow.id,
            "workflowName": workflow.name,
            "totalSteps": len(steps),
        }

        for step in steps:
            yield {
                "type": "step",
                "status": "started",
                "stepNumber": step.step_number,
                "label": step.label,
                "actionType": step.action_type,
            }
            yield {
                "type": "step",
                "status": "running",
                "stepNumber": step.step_number,
                "label": step.label,
                "message": f"Executing {step.label}…",
            }

            params = json.loads(step.parameters_json or "{}")
            plan = ActionPlan(
                action_type=step.action_type,
                params=params,
                action_id=uuid4().hex[:12],
                log_message=f"workflow:{workflow.id}:{step.step_number}",
            )
            ActionHistoryLogger(self.db).record_planned(
                user_command=f"{workflow.name}: {step.label}",
                plan=plan,
                source="automation",
            )
            step_started = time.perf_counter()
            try:
                result = execute_action_plan(
                    self.db,
                    plan,
                    user_command=f"{workflow.name}: {step.label}",
                    force=True,
                )
                ok = bool(result.get("ok"))
                message = str(result.get("message") or "")
                verified = result.get("verified")
            except DesktopBridgeError as exc:
                ok = False
                message = str(exc)
                verified = False
                result = {"ok": False, "message": message}

            step_ms = (time.perf_counter() - step_started) * 1000
            step_payload = {
                "stepNumber": step.step_number,
                "label": step.label,
                "actionType": step.action_type,
                "ok": ok,
                "message": message,
                "verified": verified,
                "durationMs": step_ms,
            }
            results.append(step_payload)

            yield {
                "type": "step",
                "status": "completed" if ok else "failed",
                "stepNumber": step.step_number,
                "label": step.label,
                "ok": ok,
                "message": message,
                "verified": verified,
                "durationMs": step_ms,
            }

            if not ok:
                overall_ok = False
                break

        payload = {
            "workflowId": workflow.id,
            "workflowName": workflow.name,
            "ok": overall_ok,
            "steps": results,
            "executionTimeMs": (time.perf_counter() - started) * 1000,
        }
        EventLogger(self.db).record(
            category="automation",
            action="workflow_run",
            status="success" if overall_ok else "failure",
            user_command=workflow.name,
            route=f"/automation/workflows/{workflow.id}/run",
            duration_ms=payload["executionTimeMs"],
            verified=all(step.get("verified") is not False for step in results if step.get("ok")),
            metadata={"workflowId": workflow.id, "stepCount": len(results)},
        )
        yield {"type": "complete", "status": "completed" if overall_ok else "failed", "payload": payload}

    @staticmethod
    def serialize_workflow(workflow: Workflow) -> dict[str, Any]:
        return {
            "id": workflow.id,
            "name": workflow.name,
            "description": workflow.description,
            "createdAt": workflow.created_at.isoformat() if workflow.created_at else None,
            "updatedAt": workflow.updated_at.isoformat() if workflow.updated_at else None,
            "steps": [
                {
                    "id": step.id,
                    "stepNumber": step.step_number,
                    "actionType": step.action_type,
                    "target": step.target,
                    "parameters": json.loads(step.parameters_json or "{}"),
                    "label": step.label,
                }
                for step in sorted(workflow.steps, key=lambda item: item.step_number)
            ],
        }
