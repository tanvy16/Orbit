from __future__ import annotations

PROCESS_ALIASES: dict[str, list[str]] = {
    "chrome": ["chrome", "google chrome"],
    "code": ["vscode", "vs code", "visual studio code", "code"],
    "cursor": ["cursor"],
    "spotify": ["spotify"],
    "discord": ["discord"],
    "notepad": ["notepad"],
    "explorer": ["file explorer", "explorer"],
}


def resolve_process_target(raw: str) -> dict[str, str]:
    normalized = raw.strip().lower()
    for key, aliases in PROCESS_ALIASES.items():
        if normalized == key or normalized in aliases:
            display = key
            if key == "code":
                display = "VS Code"
            if key == "chrome":
                display = "Chrome"
            return {"processName": key, "displayName": display}
    safe = normalized.replace(" ", "")
    return {"processName": safe, "displayName": raw.strip()}
