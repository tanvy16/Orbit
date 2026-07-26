from __future__ import annotations

from backend.app.core.logging import logger
from backend.app.database.session import engine
from backend.app.models.base import Base

# Import model so SQLAlchemy registers the table with Base.metadata.
from backend.history.models import ActionHistoryRecord  # noqa: F401


def ensure_history_tables() -> None:
    """Create action_history table if it does not exist."""
    Base.metadata.create_all(bind=engine, tables=[ActionHistoryRecord.__table__])
    logger.debug("Action history tables ensured")
