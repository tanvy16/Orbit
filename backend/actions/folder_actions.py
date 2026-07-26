from __future__ import annotations

STANDARD_FOLDERS: dict[str, list[str]] = {
    "downloads": ["downloads", "download", "my downloads"],
    "documents": ["documents", "my documents", "docs"],
    "desktop": ["desktop", "my desktop"],
    "pictures": ["pictures", "photos", "my pictures", "my photos"],
    "music": ["music", "my music"],
    "videos": ["videos", "my videos"],
    "home": ["home", "user folder", "profile"],
}


def resolve_folder_name(raw: str) -> dict[str, str]:
    normalized = raw.strip().lower()
    for key, aliases in STANDARD_FOLDERS.items():
        if normalized == key or normalized in aliases:
            label = key.capitalize()
            if key == "home":
                label = "Home"
            return {"key": key, "label": label, "custom": False}
    return {"key": normalized, "label": raw.strip(), "custom": True}
