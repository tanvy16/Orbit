from __future__ import annotations

from backend.app.core.logging import logger
from backend.app.database.session import engine
from backend.app.models.base import Base
from backend.automation.models import Workflow, WorkflowStep  # noqa: F401


def ensure_automation_tables() -> None:
    Base.metadata.create_all(bind=engine, tables=[Workflow.__table__, WorkflowStep.__table__])
    logger.debug("Automation tables ensured")
