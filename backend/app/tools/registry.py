import json
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.entities import Event

def retrieve_context(payload: dict, db: Session) -> dict:
    source = payload.get("source", "memory")
    return {
        "source": source,
        "facts": [
            "Customer tickets should be triaged before escalation.",
            "Enterprise workflows need audit logs and approvals.",
        ]
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

TOOL_MAP = {
    "retrieve_context": retrieve_context,
    "draft_message": draft_message,
    "analyze": analyze,
    "publish": publish,
    "plan_actions": plan_actions,
    "execute_actions": execute_actions,
    "approval_gate": approval_gate,
}

def run_tool(tool_name: str, payload: dict, db: Session, mission_id: str | None = None) -> dict:
    fn = TOOL_MAP.get(tool_name)
    if not fn:
        result = {"error": f"Unknown tool: {tool_name}"}
    else:
        try:
            result = fn(payload, db)
        except Exception as e:
            result = {"error": str(e)}

    if mission_id:
        db.add(Event(
            id=f"evt_{datetime.utcnow().timestamp()}".replace(".", ""),
            mission_id=mission_id,
            kind="tool_result",
            payload_json=json.dumps({"tool": tool_name, "result": result}),
        ))
        db.commit()

    return result
