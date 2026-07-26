"""End-to-end verification script for Orbit desktop action pipeline."""

from __future__ import annotations

import json
import sys

from backend.actions.action_executor import try_action_response
from backend.app.database.session import SessionLocal
from backend.app.services.desktop_bridge import bridge_health, execute_desktop_plan
from backend.automation.workflow_parser import parse_workflow_description
from backend.history.logger import ActionHistoryLogger


def main() -> int:
    print("=== Orbit Phase 5 Verification ===\n")

    bridge = bridge_health()
    print(f"1. Electron bridge health: {json.dumps(bridge)}")
    if not bridge.get("ok"):
        print("   NOTE: Bridge offline — start Orbit desktop app (`npm run dev`) for live execution.\n")

    db = SessionLocal()
    try:
        commands = [
            "Open Chrome",
            "Open Spotify",
            "Open VS Code",
            "Open File Explorer",
            "Open Downloads",
        ]

        print("2. Copilot action planning + execution")
        for command in commands:
            print(f"\n--- Command: {command}")
            response = try_action_response(db, command)
            if not response:
                print("   FAIL: No desktop action detected")
                continue
            plan = response["desktopActionPlan"]
            print(f"   Intent: {plan['type']}")
            print(f"   API layer: POST /api/v1/copilot/chat -> try_action_response()")
            print(f"   Electron IPC path: FastAPI -> desktop_bridge -> http://127.0.0.1:18766/execute")
            result = response.get("desktopActionResult")
            if result:
                status = "SUCCESS" if result.get("ok") else "FAILED"
                print(f"   Result: {status} — {result.get('message')}")
            else:
                print("   Result: not executed (requires confirmation or bridge offline)")

        print("\n3. Workflow parser")
        preview = parse_workflow_description("Open Chrome, VS Code and Downloads")
        print(f"   Generated workflow: {preview['name']} ({len(preview['steps'])} steps)")
        for step in preview["steps"]:
            print(f"   - {step['label']}")

        print("\n4. History logging")
        rows = ActionHistoryLogger(db).list_recent(limit=5)
        print(f"   Recent history entries: {len(rows)}")
        for row in rows[:3]:
            print(f"   - [{row.execution_status}] {row.user_command}")

        if bridge.get("ok"):
            print("\n5. Direct bridge smoke test")
            plan = {
                "id": "verify-bridge",
                "type": "open_folder",
                "params": {"key": "downloads", "label": "Downloads", "folder": "downloads"},
                "requiresConfirmation": False,
                "status": "pending",
            }
            direct = execute_desktop_plan(plan)
            print(f"   open_folder(downloads): {direct.get('message')} (ok={direct.get('ok')})")

    finally:
        db.close()

    print("\nVerification complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
