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
    for content_hash, count in hash_rows:
        if not content_hash:
            continue
        members = list(
            db.scalars(
                select(IndexedFile)
                .where(
                    IndexedFile.content_hash == content_hash,
                    IndexedFile.index_status == "indexed",
                )
                .limit(8)
            ).all()
        )
        if len(members) < 2:
            continue
        size_bytes = int(members[0].size_bytes or 0)
        reclaimable = size_bytes * (len(members) - 1)
        groups.append(
            {
                "type": "exact",
                "hash": content_hash[:12] + "…",
                "confidence": 1.0,
                "reason": "Identical SHA-256 content hash",
                "count": count,
                "reclaimableBytes": reclaimable,
                "files": [
                    {
                        "fileName": m.file_name,
                        "path": m.path,
                        "sizeBytes": m.size_bytes,
                    }
                    for m in members
                ],
            }
        )
    return groups


def near_duplicate_pairs(db: Session, *, limit: int = 8) -> list[dict]:
    """Filename similarity heuristic (same extension, high name match)."""
    rows = list(
        db.scalars(
            select(IndexedFile)
            .where(IndexedFile.index_status == "indexed", IndexedFile.duplicate_of_id.is_(None))
            .order_by(IndexedFile.file_name)
            .limit(160)
        ).all()
    )
    pairs: list[dict] = []
    seen_pairs: set[tuple[int, int]] = set()
    for i, a in enumerate(rows):
        for b in rows[i + 1 : i + 45]:
            pair_key = tuple(sorted((a.id, b.id)))
            if pair_key in seen_pairs:
                continue
            if a.extension and a.extension != b.extension:
                continue
            ratio = SequenceMatcher(None, a.file_name.lower(), b.file_name.lower()).ratio()
            same_size = a.size_bytes and b.size_bytes and a.size_bytes == b.size_bytes
            threshold = 0.78 if same_size else 0.82
            if ratio < threshold:
                continue
            if a.content_hash and b.content_hash and a.content_hash == b.content_hash:
                continue
            seen_pairs.add(pair_key)
            pairs.append(
                {
                    "type": "near",
                    "confidence": round(ratio, 3),
                    "reason": "Similar filenames"
                    + (" and identical size" if same_size else " (possible renamed copy)"),
                    "files": [
                        {"fileName": a.file_name, "path": a.path, "sizeBytes": a.size_bytes},
                        {"fileName": b.file_name, "path": b.path, "sizeBytes": b.size_bytes},
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
            .limit(8)
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
            if other_id == doc.id or similarity < 0.86:
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


def collect_duplicate_groups(
    db: Session,
    *,
    include_near_filename: bool = True,
    include_semantic: bool = False,
) -> dict:
    exact = exact_duplicate_groups(db)
    near = near_duplicate_pairs(db) if include_near_filename else []
    semantic = semantic_near_duplicate_pairs(db) if include_semantic else []
    reclaimable = sum(int(g.get("reclaimableBytes") or 0) for g in exact)
    return {
        "exact": exact,
        "near": near,
        "semantic": semantic,
        "totalGroups": len(exact) + len(near) + len(semantic),
        "reclaimableBytes": reclaimable,
    }


def format_duplicates_reply(groups: dict) -> str:
    exact = groups.get("exact") or []
    near = groups.get("near") or []
    semantic = groups.get("semantic") or []
    reclaimable = int(groups.get("reclaimableBytes") or 0)

    if not exact and not near and not semantic:
        return "No duplicate file clusters were detected in your indexed files."

    lines: list[str] = []
    if exact:
        lines.append(f"**Exact duplicates:** {len(exact)} group(s)")
        if reclaimable > 0:
            lines.append(f"- Potential space to reclaim: **{_format_bytes(reclaimable)}**")
        for group in exact:
            names = ", ".join(f["fileName"] for f in group["files"])
            lines.append(f"- {names} ({len(group['files'])} copies)")
    if near:
        lines.append(f"\n**Near duplicates (filename):** {len(near)} pair(s)")
        for group in near[:8]:
            names = " vs ".join(f["fileName"] for f in group["files"])
            lines.append(f"- {names} (confidence {group['confidence']})")
    if semantic:
        lines.append(f"\n**Near duplicates (semantic):** {len(semantic)} pair(s)")
        for group in semantic[:5]:
            names = " vs ".join(f["fileName"] for f in group["files"])
            lines.append(f"- {names} (confidence {group['confidence']})")
    return "\n".join(lines)


def build_duplicates_context(
    db: Session,
    *,
    include_near_filename: bool = False,
    include_semantic: bool = False,
) -> str:
    groups = collect_duplicate_groups(
        db,
        include_near_filename=include_near_filename,
        include_semantic=include_semantic,
    )
    exact = groups["exact"]
    near = groups["near"]
    semantic = groups["semantic"]
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
