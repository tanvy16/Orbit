from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4


@dataclass
class ActionCandidate:
    label: str
    path: str
    file_name: str | None = None
    document_id: int | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "label": self.label,
            "path": self.path,
            "fileName": self.file_name,
            "documentId": self.document_id,
        }


@dataclass
class ActionPlan:
    action_type: str
    params: dict[str, Any] = field(default_factory=dict)
    requires_confirmation: bool = False
    confirmation_message: str | None = None
    candidates: list[ActionCandidate] = field(default_factory=list)
    status: str = "pending"
    log_message: str | None = None
    action_id: str = field(default_factory=lambda: uuid4().hex[:12])

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "id": self.action_id,
            "type": self.action_type,
            "params": self.params,
            "requiresConfirmation": self.requires_confirmation,
            "status": self.status,
        }
        if self.confirmation_message:
            payload["confirmationMessage"] = self.confirmation_message
        if self.candidates:
            payload["candidates"] = [item.to_dict() for item in self.candidates]
        if self.log_message:
            payload["logMessage"] = self.log_message
        return payload
