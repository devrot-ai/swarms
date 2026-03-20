"""Orchestrator: thin coordinator that delegates to Planner, Executor, and Critic."""
import json
from datetime import datetime, timedelta, timezone
from typing import Generator
from sqlalchemy.orm import Session
from app.models.entities import Proposal, Mission, Step, Event
from app.schemas.contracts import AgentRunRequest
from app.agents.planner import Planner
from app.agents.executor import Executor
from app.agents.critic import Critic
from app.services.llm import synthesize_final_answer
from app.services.policy import get_policy

planner = Planner()
executor = Executor()
critic = Critic()


def _uid(prefix: str) -> str:
    return f"{prefix}_{datetime.utcnow().timestamp()}".replace(".", "")


# ── Serializers ─────────────────────────────────────────────────────

def proposal_to_dict(p: Proposal | None):
    if not p:
        return None
    return {
        "id": p.id,
        "user_id": p.user_id,
        "prompt": p.prompt,
        "summary": p.summary,
        "status": p.status,
        "approved": p.approved,
        "mission_id": p.mission_id,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def mission_to_dict(m: Mission | None):
    if not m:
        return None
    return {
        "id": m.id,
        "proposal_id": m.proposal_id,
        "title": m.title,
        "goal": m.goal,
        "status": m.status,
        "result": m.result,
        "last_event": m.last_event,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "updated_at": m.updated_at.isoformat() if m.updated_at else None,
    }


def step_to_dict(s: Step):
    return {
        "id": s.id,
        "mission_id": s.mission_id,
        "step_number": s.step_number,
        "tool_name": s.tool_name,
        "input": json.loads(s.input_json),
        "output": json.loads(s.output_json) if s.output_json else None,
        "status": s.status,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


def event_to_dict(e: Event):
    return {
        "id": e.id,
        "mission_id": e.mission_id,
        "kind": e.kind,
        "payload": json.loads(e.payload_json),
        "created_at": e.created_at.isoformat() if e.created_at else None,
        "updated_at": e.updated_at.isoformat() if e.updated_at else None,
    }


# ── Core operations ────────────────────────────────────────────────

def create_proposal(db: Session, user_id: str | None, prompt: str) -> Proposal:
    proposal = Proposal(
        id=_uid("prop"),
        user_id=user_id,
        prompt=prompt,
        summary=prompt[:500],
        status="pending",
        approved=False,
    )
    db.add(proposal)
    db.commit()
    db.refresh(proposal)
    return proposal


def maybe_auto_approve(db: Session, proposal: Proposal) -> bool:
    auto_approve = (get_policy(db, "auto_approve") or "false").lower() == "true"
    proposal.approved = auto_approve
    proposal.status = "approved" if auto_approve else "pending_approval"
    db.commit()
    db.refresh(proposal)
    return auto_approve


def create_mission_from_proposal(db: Session, proposal: Proposal):
    plan = planner.generate_plan(proposal.prompt)
    mission = Mission(
        id=_uid("miss"),
        proposal_id=proposal.id,
        title=plan.get("title", "Autonomous workflow mission"),
        goal=plan.get("goal", proposal.prompt),
        status="queued",
        result=None,
        last_event="mission_created",
    )
    db.add(mission)
    db.commit()
    db.refresh(mission)
    proposal.mission_id = mission.id
    proposal.status = "mission_created"
    db.commit()
    return mission, plan


def execute_mission(db: Session, mission: Mission, plan: dict) -> dict:
    """Execute mission via Executor, then validate via Critic."""
    result = executor.execute_plan(db, mission, plan)
    step_outputs = result["step_outputs"]
    events = result["events"]

    # Critic validation pass
    verdict = critic.validate_result(mission.goal, step_outputs)
    events.append({"kind": "critic_verdict", "payload": verdict.to_dict()})
    db.add(Event(
        id=_uid("evt"),
        mission_id=mission.id,
        kind="critic_verdict",
        payload_json=json.dumps(verdict.to_dict()),
    ))
    db.commit()

    final_text = synthesize_final_answer(mission.goal, step_outputs)
    mission.result = final_text
    if verdict.verdict == "escalate":
        mission.status = "escalated"
    elif mission.status == "needs_attention":
        mission.status = "done_with_issues"
    else:
        mission.status = "done"
    mission.last_event = "mission_done"
    db.add(Event(
        id=_uid("evt"),
        mission_id=mission.id,
        kind="mission_done",
        payload_json=json.dumps({"result": final_text, "critic": verdict.to_dict()}),
    ))
    db.commit()
    return {"final": final_text, "steps": step_outputs, "events": events, "critic": verdict.to_dict()}


# ── Closed-loop runners ────────────────────────────────────────────

def run_closed_loop(db: Session, request: AgentRunRequest) -> dict:
    proposal = create_proposal(db, request.user_id, request.input)
    approved = maybe_auto_approve(db, proposal)

    if not approved:
        return {
            "proposal_id": proposal.id,
            "mission_id": None,
            "status": "pending_approval",
            "response": "Proposal created and waiting for approval.",
            "steps": [],
            "events": [],
            "approved": False,
        }

    mission, plan = create_mission_from_proposal(db, proposal)
    result = execute_mission(db, mission, plan)

    return {
        "proposal_id": proposal.id,
        "mission_id": mission.id,
        "status": mission.status,
        "response": result["final"],
        "steps": result["steps"],
        "events": result["events"],
        "approved": True,
    }


def run_closed_loop_stream(db: Session, request: AgentRunRequest) -> Generator[str, None, None]:
    """Generator that yields SSE events at each lifecycle stage."""

    def _sse(event_type: str, data: dict) -> str:
        return f"data: {json.dumps({'type': event_type, 'data': data})}\n\n"

    # 1. Proposal
    proposal = create_proposal(db, request.user_id, request.input)
    yield _sse("proposal_created", {"proposal_id": proposal.id, "prompt": proposal.prompt})

    # 2. Auto-approve
    approved = maybe_auto_approve(db, proposal)
    yield _sse("approval", {"approved": approved, "status": proposal.status})

    if not approved:
        yield _sse("done", {"status": "pending_approval", "response": "Waiting for approval."})
        return

    # 3. Mission creation
    mission, plan = create_mission_from_proposal(db, proposal)
    yield _sse("mission_created", {"mission_id": mission.id, "title": mission.title, "plan": plan})

    # 4. Execute steps one by one
    mission.status = "running"
    db.commit()

    step_outputs: list[dict] = []
    steps = plan.get("steps", [])
    for idx, step_def in enumerate(steps, start=1):
        tool_name = step_def.get("tool", "unknown")
        input_payload = step_def.get("input", {})

        yield _sse("step_started", {"step": idx, "tool": tool_name, "input": input_payload})

        from app.tools.registry import run_tool
        result = run_tool(tool_name, input_payload, db=db, mission_id=mission.id)

        status = "success" if "error" not in result else "failed"
        step_data = {"step": idx, "tool": tool_name, "status": status, "output": result}
        step_outputs.append({"step_number": idx, "tool": tool_name, "input": input_payload, "output": result})

        yield _sse("step_completed" if status == "success" else "step_failed", step_data)

        if "error" in result:
            mission.status = "needs_attention"
            mission.last_event = "step_failed"
            db.commit()
            break

    # 5. Critic
    verdict = critic.validate_result(mission.goal, step_outputs)
    yield _sse("critic_verdict", verdict.to_dict())

    # 6. Final synthesis
    final_text = synthesize_final_answer(mission.goal, step_outputs)
    mission.result = final_text
    if verdict.verdict == "escalate":
        mission.status = "escalated"
    elif mission.status == "needs_attention":
        mission.status = "done_with_issues"
    else:
        mission.status = "done"
    mission.last_event = "mission_done"
    db.commit()

    yield _sse("mission_done", {
        "mission_id": mission.id,
        "status": mission.status,
        "response": final_text,
        "critic": verdict.to_dict(),
    })


# ── Recovery & state ───────────────────────────────────────────────

def recover_stale_missions(db: Session, minutes: int = 30) -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    stale = []
    missions = db.query(Mission).filter(Mission.status.in_(["queued", "running"])).all()
    for m in missions:
        if m.created_at and m.created_at.replace(tzinfo=timezone.utc) < cutoff:
            m.status = "recovered"
            m.last_event = "stale_recovered"
            db.add(Event(
                id=_uid("evt"),
                mission_id=m.id,
                kind="stale_recovered",
                payload_json=json.dumps({"minutes": minutes}),
            ))
            stale.append({"mission_id": m.id, "status": m.status})
    db.commit()
    return stale


def state_snapshot(db: Session, proposal_id: str | None = None, mission_id: str | None = None):
    proposal = db.get(Proposal, proposal_id) if proposal_id else None
    if mission_id:
        mission = db.get(Mission, mission_id)
    elif proposal:
        mission = db.query(Mission).filter(Mission.proposal_id == proposal.id).first()
    else:
        mission = None

    steps = []
    events = []
    if mission:
        steps = [step_to_dict(s) for s in db.query(Step).filter(Step.mission_id == mission.id).order_by(Step.step_number.asc()).all()]
        events = [event_to_dict(e) for e in db.query(Event).filter(Event.mission_id == mission.id).order_by(Event.created_at.asc()).all()]

    policies = {}
    for key in ["auto_approve", "worker_policy", "x_daily_quota", "reaction_matrix"]:
        val = get_policy(db, key)
        if val is not None:
            policies[key] = val

    return {
        "proposal": proposal_to_dict(proposal),
        "mission": mission_to_dict(mission),
        "steps": steps,
        "events": events,
        "policies": policies,
    }
