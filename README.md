# Orbit

**Orbit** is an AI-powered desktop operating intelligence platform. Phase 1 delivers a production-grade foundation: Electron shell, React UI, FastAPI backend, SQLite persistence, secure IPC, routing, theming, and placeholder modules for future AI and automation features.

## Tech stack

- **Desktop:** Electron (context isolation, preload bridge)
- **Frontend:** React 19, TypeScript, Tailwind CSS, Zustand, TanStack Query, React Router, Framer Motion
- **Backend:** FastAPI, SQLAlchemy, SQLite
- **Tooling:** ESLint, Prettier, Husky, electron-vite, Electron Builder

## Prerequisites

- Node.js 20+ and npm
- Python 3.11+ (3.14 supported)
- Windows / macOS / Linux

## Setup

```bash
# Clone and enter the repository
cd Orbit

# Install Node dependencies
npm install

# Python backend dependencies
python -m pip install -r backend/requirements.txt

# Environment (optional — defaults work for local dev)
copy .env.example .env
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Starts FastAPI + Electron (Vite HMR) together |
| `npm run dev:vite` | Electron + Vite only (backend must run separately) |
| `npm run dev:backend` | FastAPI with hot reload on `127.0.0.1:18765` |
| `npm run build` | Typecheck + electron-vite production build |
| `npm run build:app` | Build + package with Electron Builder |
| `npm run lint` | ESLint (zero warnings) |
| `npm run typecheck` | TypeScript strict check |
| `npm run format` | Prettier write |

## Development workflow

1. Run `npm run dev` from the project root.
2. Confirm **Dashboard** shows API health (`database: ok`) and IPC ping from the main process.
3. Navigate all sidebar routes — each placeholder page should load with theme persistence.
4. Before commits, Husky runs lint + typecheck via `pre-commit`.

## Folder structure

```
Orbit/
├── electron/           # Main process, IPC handlers, window lifecycle
│   ├── main/
│   └── preload/
├── frontend/           # React renderer (Vite root)
│   └── src/
│       ├── components/ # Reusable UI
│       ├── pages/      # Route views
│       ├── layouts/    # App shell, sidebar, top nav
│       ├── hooks/
│       ├── services/   # API + IPC clients
│       ├── stores/     # Zustand (theme, UI)
│       ├── router/
│       ├── config/
│       ├── utils/
│       └── assets/
├── backend/            # FastAPI application
│   └── app/
│       ├── api/        # Routes
│       ├── services/   # Business logic (Phase 2+)
│       ├── models/     # SQLAlchemy entities
│       ├── database/
│       ├── middleware/
│       └── core/       # Config, logging
├── shared/             # Cross-process TypeScript types & IPC contracts
├── documentation/      # Extended docs (see root ARCHITECTURE.md)
├── ARCHITECTURE.md
├── PROJECT_PROGRESS.md
└── CHANGELOG.md
```

## Architecture overview

- **Renderer** talks to **FastAPI** over HTTP (`/api/v1/health`).
- **Renderer** talks to **Electron main** via `window.orbit` (context-bridge IPC).
- **Shared types** define IPC channel names so main, preload, and UI stay aligned.
- **SQLite** stores placeholder tables for settings, files, conversations, metrics, automation, and notifications.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for diagrams and Phase 2 integration points.

## License

MIT
