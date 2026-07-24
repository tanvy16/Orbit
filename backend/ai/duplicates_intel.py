from __future__ import annotations

from difflib import SequenceMatcher

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.models.entities import IndexedFile
from backend.app.services.search_service import SearchService


def _format_bytes(num: int) -> str:
    if num < 1024**2:
        return f"{num / 1024:.1f} KB"
    if num < 1024**3:
        return f"{num / 1024**2:.1f} MB"
    return f"{num / 1024**3:.2f} GB"


def exact_duplicate_groups(db: Session, *, limit: int = 8) -> list[dict]:
    """SHA-256 (content_hash) duplicate clusters already tracked in SQLite."""
    hash_rows = db.execute(
        select(IndexedFile.content_hash, func.count())
        .where(
            IndexedFile.index_status == "indexed",
            IndexedFile.content_hash.isnot(None),
        )
        .group_by(IndexedFile.content_hash)
        .having(func.count() > 1)
        .order_by(func.count().desc())
        .limit(limit)
    ).all()

    groups: list[dict] = []
    for content_hash, _count in hash_rows:
        if not content_hash:
            continue
        members = list(
            db.scalars(
                select(IndexedFile)
                .where(
                    IndexedFile.content_hash == content_hash,
                    IndexedFile.index_status == "indexed",
                )
                .limit(6)
            ).all()
        )
        if len(members) < 2:
            continue
        groups.append(
            {
                "type": "exact",
                "hash": content_hash[:12] + "…",
                "confidence": 1.0,
                "reason": "Identical SHA-256 content hash",
                "files": [
                    {"fileName": m.file_name, "path": m.path, "sizeBytes": m.size_bytes}
                    for m in members
                ],
            }
        )
    return groups


def near_duplicate_pairs(db: Session, *, limit: int = 5) -> list[dict]:
    """Filename similarity heuristic (same extension, high name match)."""
    rows = list(
        db.scalars(
            select(IndexedFile)
            .where(IndexedFile.index_status == "indexed", IndexedFile.duplicate_of_id.is_(None))
            .order_by(IndexedFile.file_name)
            .limit(120)
        ).all()
    )
    pairs: list[dict] = []
    for i, a in enumerate(rows):
        for b in rows[i + 1 : i + 40]:
            if a.extension and a.extension != b.extension:
                continue
            ratio = SequenceMatcher(None, a.file_name.lower(), b.file_name.lower()).ratio()
            if ratio < 0.82:
                continue
            if a.content_hash and b.content_hash and a.content_hash == b.content_hash:
                continue
            pairs.append(
                {
                    "type": "near",
                    "confidence": round(ratio, 3),
                    "reason": "Similar filenames (possible renamed or revised copy)",
                    "files": [
                        {"fileName": a.file_name, "path": a.path},
                        {"fileName": b.file_name, "path": b.path},
                    ],
                }
            )
            if len(pairs) >= limit:
                return pairs
    return pairs


def semantic_near_duplicate_pairs(db: Session, *, limit: int = 3) -> list[dict]:
    """Cross-document semantic similarity via existing SearchService."""
    candidates = list(
        db.scalars(
            select(IndexedFile)
            .where(
                IndexedFile.index_status == "indexed",
                IndexedFile.duplicate_of_id.is_(None),
                IndexedFile.embedding_status == "embedded",
            )
            .order_by(IndexedFile.modified_at.desc())
            .limit(5)
        ).all()
    )
    if not candidates:
        return []

    search = SearchService(db)
    pairs: list[dict] = []
    for doc in candidates:
        try:
            result = search.semantic_search(doc.file_name, 1, 4, None, None)
        except Exception:
            continue
        for item in result.get("items") or []:
            other_id = item.get("documentId")
            similarity = float(item.get("similarity") or 0)
            if other_id == doc.id or similarity < 0.88:
                continue
            pairs.append(
                {
                    "type": "near_semantic",
                    "confidence": round(similarity, 3),
                    "reason": "High embedding similarity between indexed documents",
                    "files": [
                        {"fileName": doc.file_name, "path": doc.path},
                        {
                            "fileName": item.get("fileName"),
                            "path": item.get("path"),
                        },
                    ],
                }
            )
            break
        if len(pairs) >= limit:
            break
    return pairs


def build_duplicates_context(
    db: Session,
    *,
    include_near_filename: bool = False,
    include_semantic: bool = False,
) -> str:
    exact = exact_duplicate_groups(db)
    near = near_duplicate_pairs(db) if include_near_filename or include_semantic else []
    semantic = semantic_near_duplicate_pairs(db) if include_semantic else []
    if not exact and not near and not semantic:
        return "No duplicate file clusters detected in the index."

    lines: list[str] = []
    if exact:
        lines.append("Exact duplicates (hash):")
        for g in exact:
            names = ", ".join(f["fileName"] for f in g["files"])
            lines.append(f"- {names} (confidence {g['confidence']})")
    if near:
        lines.append("Near duplicates (filename similarity):")
        for g in near:
            names = " vs ".join(f["fileName"] for f in g["files"])
            lines.append(f"- {names} (confidence {g['confidence']}, {g['reason']})")
    if semantic:
        lines.append("Near duplicates (embedding similarity):")
        for g in semantic:
            names = " vs ".join(f["fileName"] for f in g["files"])
            lines.append(f"- {names} (confidence {g['confidence']}, {g['reason']})")
    return "\n".join(lines)
