# Changelog

All notable changes to Orbit are documented in this file.

## [0.3.0] — 2026-07-23

### Added

- ChromaDB vector store linked to SQLite document metadata
- Automatic embedding pipeline (extract → chunk → embed → sync)
- Background embedding worker with backfill for existing indexed files
- Semantic search API and full Search UI
- Dashboard vector/embedding status; Settings for models and rebuild
- Secure `orbit:fs:open-path` IPC for opening documents from search

## [0.2.0] — 2026-07-23

### Added

- Desktop integration layer: secure Electron filesystem IPC and path guard
- Background indexing engine with incremental fingerprints, hashing, and SQLite persistence
- Chokidar file watcher with debounced re-indexing and delete handling
- Background task tracking API and UI progress on Documents
- Document management REST API (list, stats, batch upsert, folder fingerprints)
- Functional Documents, Settings, and Notifications pages
- Metadata extraction for PDF, DOCX, XLSX, text, and code files
- Extension point stubs for semantic search, copilot, RAG, monitoring, analytics, automation

## [0.1.0] — 2026-07-23

### Added

- Phase 1 foundation: Electron + React + FastAPI + SQLite
- Secure IPC bridge with shared channel contracts
- Application shell with collapsible sidebar, top navigation, and theme system
- Placeholder pages for Dashboard, Copilot, Search, Documents, Automation, Analytics, Notifications, History, Settings, About
- Reusable UI components (Button, Card, Badge, Spinner, Empty/Error states)
- Backend health endpoint and SQLAlchemy placeholder models
- Developer tooling: ESLint, Prettier, Husky, electron-vite, Electron Builder config
- Project documentation (README, ARCHITECTURE, PROJECT_PROGRESS)
