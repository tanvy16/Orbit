from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.api.schemas import MaintenanceRequest, SettingsUpdate
from backend.app.database.session import get_db
from backend.app.services.settings_service import SettingsService

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("")
def get_settings(db: Session = Depends(get_db)) -> dict:
    return SettingsService(db).get_settings()


@router.patch("")
def update_settings(payload: SettingsUpdate, db: Session = Depends(get_db)) -> dict:
    return SettingsService(db).update_settings(payload)


@router.post("/maintenance")
def run_maintenance(payload: MaintenanceRequest, db: Session = Depends(get_db)) -> dict:
    return SettingsService(db).maintenance(payload.pruneRemoved, payload.recomputeDuplicateFlags)
