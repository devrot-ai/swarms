"""Executor agent: runs a mission plan step by step with validation and retries."""
from __future__ import annotations
import json
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.entities import Mission, Step, Event
from app.services.agent_manager import choose_agent_for_tool
from app.services.queue import enqueue_task, mark_task_running, mark_task_done, mark_task_failed, publish_event
from app.tools.registry import run_tool

logger = logging.getLogger("swarms.executor")

MAX_RETRIES = 2


def _uid(prefix: str) -> str:
    return f"{prefix}_{datetime.utcnow().timestamp()}".replace(".", "")


class Executor:
    """Executes a structured plan against the tool registry."""

    def __init__(self, max_retries: int = MAX_RETRIES):
        self.max_retries = max_retries

    def execute_plan(self, db: Session, mission: Mission, plan: dict) -> dict:
        """Run each step, emitting events. Returns step_outputs and events."""
        mission.status = "running"
        db.commit()
        publish_event("mission_started", {"mission_id": mission.id, "title": mission.title})

        step_outputs: list[dict] = []
        events: list[dict] = []

        db.add(Event(
            id=_uid("evt"),
            mission_id=mission.id,
            kind="mission_started",
            payload_json=json.dumps({"mission_id": mission.id, "title": mission.title}),
        ))
        db.commit()

        steps = plan.get("steps", [])
        for idx, step_def in enumerate(steps, start=1):
            tool_name = step_def.get("tool", "unknown")
            input_payload = step_def.get("input", {})
            assigned_agent = choose_agent_for_tool(db, tool_name)
            queued_task = enqueue_task(
                db=db,
                mission_id=mission.id,
                agent_id=assigned_agent.id if assigned_agent else None,
                payload={
                    "step": idx,
                    "tool": tool_name,
                    "input": input_payload,
                    "reason": step_def.get("reason", ""),
                },
            )
            mark_task_running(db, queued_task.id)
            publish_event(
                "step_assigned",
                {
                    "mission_id": mission.id,
                    "step": idx,
                    "tool": tool_name,
                    "task_id": queued_task.id,
                    "agent_id": assigned_agent.id if assigned_agent else None,
                },
            )

            step_row = Step(
                id=_uid("step"),
                mission_id=mission.id,
                step_number=idx,
                tool_name=tool_name,
                input_json=json.dumps(input_payload),
                output_json=None,
                status="running",
            )
            db.add(step_row)
            db.commit()
            db.refresh(step_row)

            # Retry loop
            result = None
            for attempt in range(1, self.max_retries + 1):
                result = run_tool(tool_name, input_payload, db=db, mission_id=mission.id)
                if "error" not in result:
                    break
                logger.warning(
                    "Step %d tool '%s' attempt %d/%d failed: %s",
                    idx, tool_name, attempt, self.max_retries, result.get("error"),
                )

            step_row.output_json = json.dumps(result)
            step_row.status = "success" if "error" not in result else "failed"
            db.commit()

            if "error" in result:
                mark_task_failed(db, queued_task.id, str(result.get("error")))
            else:
                mark_task_done(db, queued_task.id, result)

            step_outputs.append({
                "step_number": idx,
                "tool": tool_name,
                "input": input_payload,
                "output": result,
            })

            kind = "step_completed" if "error" not in result else "step_failed"
            event_payload = {"step": idx, "tool": tool_name, "result": result}
            events.append({"kind": kind, "payload": event_payload})
            db.add(Event(
                id=_uid("evt"),
                mission_id=mission.id,
                kind=kind,
                payload_json=json.dumps(event_payload),
            ))
            db.commit()

            if "error" in result:
                mission.status = "needs_attention"
                mission.last_event = "step_failed"
                db.commit()
                break

        return {"step_outputs": step_outputs, "events": events}
