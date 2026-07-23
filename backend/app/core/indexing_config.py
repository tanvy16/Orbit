"""Shared indexing configuration."""
from __future__ import annotations

DEFAULT_SUPPORTED_EXTENSIONS: frozenset[str] = frozenset(
    {
        ".pdf",
        ".docx",
        ".xlsx",
        ".txt",
        ".md",
        ".markdown",
        ".csv",
        ".json",
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".webp",
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".py",
        ".java",
        ".go",
        ".rs",
        ".cpp",
        ".c",
        ".h",
        ".html",
        ".css",
        ".scss",
        ".yaml",
        ".yml",
        ".xml",
        ".log",
    }
)

DEFAULT_IGNORED_DIRECTORY_NAMES: frozenset[str] = frozenset(
    {
        "node_modules",
        ".git",
        ".svn",
        "dist",
        "build",
        "out",
        "release",
        "__pycache__",
        ".venv",
        "venv",
        ".idea",
        ".vscode",
    }
)

SETTINGS_KEY = "orbit.app.settings"
