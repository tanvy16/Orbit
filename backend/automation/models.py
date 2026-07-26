from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.models.base import Base, TimestampMixin


class Workflow(Base, TimestampMixin):
    __tablename__ = "workflows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(256), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    steps: Mapped[list["WorkflowStep"]] = relationship(
        "WorkflowStep",
        back_populates="workflow",
        cascade="all, delete-orphan",
        order_by="WorkflowStep.step_number",
    )


class WorkflowStep(Base, TimestampMixin):
    __tablename__ = "workflow_steps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workflow_id: Mapped[int] = mapped_column(ForeignKey("workflows.id", ondelete="CASCADE"), index=True)
    step_number: Mapped[int] = mapped_column(Integer, default=1)
    action_type: Mapped[str] = mapped_column(String(64), index=True)
    target: Mapped[str] = mapped_column(String(512), default="")
    parameters_json: Mapped[str] = mapped_column(Text, default="{}")
    label: Mapped[str] = mapped_column(String(512), default="")

    workflow: Mapped["Workflow"] = relationship("Workflow", back_populates="steps")
