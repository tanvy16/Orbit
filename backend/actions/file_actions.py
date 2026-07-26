from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from backend.actions.app_launcher import resolve_app_name
from backend.actions.folder_actions import resolve_folder_name
from backend.actions.process_manager import resolve_process_target
from backend.actions.types import ActionCandidate, ActionPlan
from backend.app.models.entities import IndexedFile
from backend.app.services.search_service import SearchService


def search_indexed_files(
    db: Session,
    *,
    query: str,
    extension: str | None = None,
    latest: bool = False,
    limit: int = 8,
) -> list[ActionCandidate]:
    trimmed = query.strip()
    stmt = select(IndexedFile).where(IndexedFile.index_status == "indexed")

    if extension:
        ext = extension if extension.startswith(".") else f".{extension}"
        stmt = stmt.where(IndexedFile.extension == ext.lower())

    if trimmed:
        like = f"%{trimmed}%"
        stmt = stmt.where(
            or_(
                IndexedFile.file_name.ilike(like),
                IndexedFile.path.ilike(like),
            )
        )

    rows = db.scalars(stmt.order_by(IndexedFile.modified_at.desc()).limit(limit * 3)).all()
    if not rows and trimmed:
        try:
            semantic = SearchService(db).semantic_search(trimmed, page=1, page_size=limit, folder_id=None, extension=extension)
            items = semantic.get("items") or []
            return [
                ActionCandidate(
                    label=str(item.get("fileName") or item.get("path") or "File"),
                    path=str(item.get("path") or ""),
                    file_name=item.get("fileName"),
                    document_id=item.get("documentId"),
                )
                for item in items
                if item.get("path")
            ]
        except Exception:
            rows = []

    if latest and rows:
        rows = sorted(rows, key=_modified_sort_key, reverse=True)[:limit]
    else:
        rows = rows[:limit]

    return [
        ActionCandidate(
            label=row.file_name or row.path,
            path=row.path,
            file_name=row.file_name,
            document_id=row.id,
        )
        for row in rows
    ]


def resolve_file_target(db: Session, query: str) -> list[ActionCandidate]:
    return search_indexed_files(db, query=query, limit=5)


def enrich_action_plan(db: Session, plan: ActionPlan) -> ActionPlan:
    """Attach resolved targets and candidates before returning to the client."""
    action_type = plan.action_type
    params = dict(plan.params)

    if action_type == "launch_app":
        resolved = resolve_app_name(str(params.get("app") or ""))
        params.update(resolved)
        plan.params = params
        return plan

    if action_type == "open_folder":
        resolved = resolve_folder_name(str(params.get("folder") or ""))
        params.update(resolved)
        plan.params = params
        return plan

    if action_type in {"close_process", "restart_process"}:
        resolved = resolve_process_target(str(params.get("target") or ""))
        params.update(resolved)
        plan.params = params
        return plan

    if action_type == "open_file":
        query = str(params.get("query") or "")
        candidates = resolve_file_target(db, query)
        plan.candidates = candidates
        if len(candidates) == 1:
            plan.action_type = "open_file"
            plan.params = {"path": candidates[0].path, "fileName": candidates[0].file_name}
            plan.status = "pending"
        elif len(candidates) > 1:
            plan.status = "awaiting_choice"
        return plan

    if action_type == "file_search":
        query = str(params.get("query") or "")
        extension = params.get("extension")
        latest = bool(params.get("latest"))
        if "last week" in query.lower():
            candidates = _filter_last_week(search_indexed_files(db, query=_strip_time_hint(query), extension=extension))
        else:
            candidates = search_indexed_files(db, query=query, extension=extension, latest=latest)
        plan.candidates = candidates
        if len(candidates) == 1:
            plan.action_type = "open_file"
            plan.params = {"path": candidates[0].path, "fileName": candidates[0].file_name}
            plan.status = "pending"
        elif len(candidates) > 1:
            plan.status = "awaiting_choice"
        return plan

    if action_type in {"file_delete", "file_rename", "file_move", "file_copy"}:
        target_key = "target" if action_type == "file_delete" else "source"
        target = str(params.get(target_key) or "")
        matches = resolve_file_target(db, target)
        if len(matches) == 1:
            params[f"{target_key}Path"] = matches[0].path
            plan.params = params
        elif len(matches) > 1:
            plan.candidates = matches
            plan.status = "awaiting_choice"
        return plan

    return plan


def format_candidates_reply(candidates: list[ActionCandidate]) -> str:
    if not candidates:
        return "I couldn't find any matching indexed files."
    if len(candidates) == 1:
        return f"I found **{candidates[0].label}**. Opening it now…"
    lines = [f"I found **{len(candidates)}** matching files:", ""]
    for index, item in enumerate(candidates[:5], start=1):
        lines.append(f"{index}. **{item.label}**")
    lines.append("")
    lines.append("Which one would you like to open?")
    return "\n".join(lines)


def _modified_sort_key(row: IndexedFile) -> datetime:
    raw = (row.modified_at or "").strip()
    if not raw:
        return datetime.min.replace(tzinfo=timezone.utc)
    try:
        if raw.endswith("Z"):
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return datetime.fromisoformat(raw)
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)


def _filter_last_week(candidates: list[ActionCandidate]) -> list[ActionCandidate]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    # Without per-candidate timestamps in ActionCandidate, return as-is; Electron path mtime can refine later.
    return candidates


def _strip_time_hint(query: str) -> str:
    return re.sub(r"\b(from last week|last week)\b", "", query, flags=re.I).strip()
