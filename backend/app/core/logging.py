import logging
import sys

from backend.app.core.config import settings


def setup_logging() -> None:
    level = getattr(logging, settings.orbit_log_level.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        stream=sys.stdout,
    )


logger = logging.getLogger("orbit.api")
