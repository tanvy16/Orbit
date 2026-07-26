import json


def test_workflow_sse_event_shape():
    queued = {
        "type": "workflow",
        "status": "queued",
        "workflowId": 1,
        "workflowName": "Test",
        "totalSteps": 2,
    }
    step = {
        "type": "step",
        "status": "running",
        "stepNumber": 1,
        "label": "Open Chrome",
        "message": "Executing Open Chrome…",
    }
    complete = {
        "type": "complete",
        "status": "completed",
        "payload": {"workflowId": 1, "workflowName": "Test", "ok": True, "steps": [], "executionTimeMs": 100},
    }

    for event in (queued, step, complete):
        line = f"data: {json.dumps(event)}\n\n"
        assert line.startswith("data: ")
        parsed = json.loads(line.strip().removeprefix("data:").strip())
        assert parsed["type"] in {"workflow", "step", "complete"}
