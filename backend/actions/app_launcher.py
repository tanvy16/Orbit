from __future__ import annotations

import re
KNOWN_APPS: dict[str, list[str]] = {
    "chrome": ["chrome", "google chrome", "google-chrome"],
    "vscode": ["vscode", "vs code", "visual studio code", "code"],
    "cursor": ["cursor"],
    "spotify": ["spotify"],
    "discord": ["discord"],
    "notepad": ["notepad", "notepad++", "notepad plus plus"],
    "explorer": ["file explorer", "explorer", "files", "windows explorer"],
}


def resolve_app_name(raw: str) -> dict[str, str]:
    """Map a user-provided app label to a resolver query for Electron.

    KNOWN_APPS aliases are a fallback when the user's phrase does not match a
    clean query string. Primary discovery happens in the Electron
    ``windows-app-resolver`` (PATH, registry, Start Menu, installed apps).
    """
    normalized = raw.strip().lower()
    normalized = re.sub(r"^(?:launch|open|start|run)\s+", "", normalized)
    normalized = re.sub(r"\s+(?:app|application)$", "", normalized).strip()
    for key, aliases in KNOWN_APPS.items():
        if normalized == key or normalized in aliases:
            display = key if key != "vscode" else "VS Code"
            if key == "chrome":
                display = "Google Chrome"
            if key == "explorer":
                display = "File Explorer"
            if key == "spotify":
                display = "Spotify"
            return {"key": key, "displayName": display, "query": normalized}
    return {
        "key": normalized.replace(" ", "-"),
        "displayName": raw.strip(),
        "query": normalized,
    }
