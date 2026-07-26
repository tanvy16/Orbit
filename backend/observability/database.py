from __future__ import annotations

from backend.app.core.logging import logger
from backend.app.database.session import engine
from backend.app.models.base import Base
from backend.observability.models import EventLogRecord  # noqa: F401


def ensure_observability_tables() -> None:
    Base.metadata.create_all(bind=engine, tables=[EventLogRecord.__table__])
    logger.debug("Observability tables ensured")
