"""Tool registry with schema validation and execution."""
import json
import logging
from datetime import datetime
from pydantic import ValidationError as PydanticValidationError
from sqlalchemy.orm import Session
from app.models.entities import Event
from app.tools.schemas import INPUT_MODELS, get_tool_definitions  # noqa: F401

logger = logging.getLogger("swarms.tools")


# ── Tool implementations ────────────────────────────────────────────

def retrieve_context(payload: dict, db: Session) -> dict:
    source = payload.get("source", "memory")
    return {
        "source": source,
        "facts": [
            "Customer tickets should be triaged before escalation.",
            "Enterprise workflows need audit logs and approvals.",
        ],
    }


def draft_message(payload: dict, db: Session) -> dict:
    tone = payload.get("tone", "professional")
    return {"draft": f"[{tone}] Draft created for the requested workflow."}


def analyze(payload: dict, db: Session) -> dict:
    return {"insight": "The task appears suitable for an autonomous workflow with approval gates."}


def publish(payload: dict, db: Session) -> dict:
    return {"channel": payload.get("channel", "dashboard"), "published": True}


def plan_actions(payload: dict, db: Session) -> dict:
    objective = payload.get("objective", "")
    return {"objective": objective, "actions": ["retrieve_context", "execute_actions", "finalize"]}


def execute_actions(payload: dict, db: Session) -> dict:
    return {"executed": True, "count": int(payload.get("limit", 3))}


def approval_gate(payload: dict, db: Session) -> dict:
    risk = payload.get("risk", "low")
    approved = risk != "high"
    return {"approved": approved, "risk": risk}


# ── Registry ────────────────────────────────────────────────────────

TOOL_MAP: dict[str, dict] = {
    "retrieve_context": {"fn": retrieve_context},
    "draft_message": {"fn": draft_message},
    "analyze": {"fn": analyze},
    "publish": {"fn": publish},
    "plan_actions": {"fn": plan_actions},
    "execute_actions": {"fn": execute_actions},
    "approval_gate": {"fn": approval_gate},
}


def _uid(prefix: str) -> str:
    return f"{prefix}_{datetime.utcnow().timestamp()}".replace(".", "")


def run_tool(tool_name: str, payload: dict, db: Session, mission_id: str | None = None) -> dict:
    """Validate input against schema, execute tool, and log event."""
    entry = TOOL_MAP.get(tool_name)
    if not entry:
        result = {"error": f"Unknown tool: {tool_name}"}
    else:
        # Validate input against Pydantic model if one exists
        input_model = INPUT_MODELS.get(tool_name)
        if input_model:
            try:
                validated = input_model(**payload)
                payload = validated.model_dump()
            except PydanticValidationError as ve:
                result = {"error": f"Input validation failed for '{tool_name}'", "details": ve.errors()}
                if mission_id:
                    _emit_event(db, mission_id, tool_name, result)
                return result

        try:
            result = entry["fn"](payload, db)
        except Exception as e:
            logger.exception("Tool '%s' raised an exception", tool_name)
            result = {"error": str(e)}

    if mission_id:
        _emit_event(db, mission_id, tool_name, result)

    return result


def _emit_event(db: Session, mission_id: str, tool_name: str, result: dict) -> None:
    db.add(Event(
        id=_uid("evt"),
        mission_id=mission_id,
        kind="tool_result",
        payload_json=json.dumps({"tool": tool_name, "result": result}),
    ))
    db.commit()
