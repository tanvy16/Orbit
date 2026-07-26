from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from backend.app.models.entities import HistoricalMetric


class HistoricalMetricsService:
    METRIC_KEYS = ("cpu", "ram", "disk", "network_down", "network_up")

    def __init__(self, db: Session) -> None:
        self.db = db

    def record_snapshot(self, snapshot: dict) -> None:
        now = datetime.now(timezone.utc)
        ts = now.isoformat()
        rows = [
            ("cpu", float(snapshot.get("cpu", {}).get("usagePercent", 0))),
            ("ram", float(snapshot.get("memory", {}).get("usagePercent", 0))),
            ("disk", float(snapshot.get("disk", {}).get("usagePercent", 0))),
            ("network_down", float(snapshot.get("network", {}).get("downloadBytesPerSec", 0))),
            ("network_up", float(snapshot.get("network", {}).get("uploadBytesPerSec", 0))),
        ]
        for key, value in rows:
            self.db.add(
                HistoricalMetric(
                    metric_key=key,
                    value=value,
                    recorded_at=ts,
                    created_at=now,
                    updated_at=now,
                )
            )
        self.db.commit()

    def query(self, metric_key: str, *, hours: float = 1.0, limit: int = 500) -> list[dict]:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        rows = self.db.scalars(
            select(HistoricalMetric)
            .where(HistoricalMetric.metric_key == metric_key)
            .where(HistoricalMetric.created_at >= cutoff)
            .order_by(desc(HistoricalMetric.created_at))
            .limit(limit)
        ).all()
        return [
            {
                "metricKey": row.metric_key,
                "value": row.value,
                "recordedAt": row.recorded_at,
            }
            for row in reversed(list(rows))
        ]

    def prune_older_than_hours(self, hours: float = 48.0) -> int:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        rows = list(
            self.db.scalars(
                select(HistoricalMetric).where(HistoricalMetric.created_at < cutoff)
            ).all()
        )
        for row in rows:
            self.db.delete(row)
        self.db.commit()
        return len(rows)
