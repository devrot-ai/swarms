import json
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.models.entities import Proposal, Mission, Step, Event
from app.schemas.contracts import AgentRunRequest
from app.services.llm import generate_plan, synthesize_final_answer
from app.services.policy import get_policy
from app.tools.registry import run_tool

def _uid(prefix: str) -> str:
    return f"{prefix}_{datetime.utcnow().timestamp()}".replace(".", "")

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
    plan = generate_plan(proposal.prompt)
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
    mission.status = "running"
    db.commit()

    step_outputs = []
    events = []

    db.add(Event(
        id=_uid("evt"),
        mission_id=mission.id,
        kind="mission_started",
        payload_json=json.dumps({"mission_id": mission.id, "title": mission.title}),
    ))
    db.commit()

    steps = plan.get("steps", [])
    for idx, step in enumerate(steps, start=1):
        tool_name = step.get("tool", "unknown")
        input_payload = step.get("input", {})
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

        result = run_tool(tool_name, input_payload, db=db, mission_id=mission.id)
        step_row.output_json = json.dumps(result)
        step_row.status = "success" if "error" not in result else "failed"
        db.commit()

        step_outputs.append({
            "step_number": idx,
            "tool": tool_name,
            "input": input_payload,
            "output": result,
        })

        kind = "step_completed" if "error" not in result else "step_failed"
        events.append({"kind": kind, "payload": {"step": idx, "tool": tool_name, "result": result}})
        db.add(Event(
            id=_uid("evt"),
            mission_id=mission.id,
            kind=kind,
            payload_json=json.dumps({"step": idx, "tool": tool_name, "result": result}),
        ))
        db.commit()

        if "error" in result:
            mission.status = "needs_attention"
            mission.last_event = "step_failed"
            db.commit()
            break

    final_text = synthesize_final_answer(mission.goal, step_outputs)
    mission.result = final_text
    mission.status = "done" if mission.status != "needs_attention" else "done_with_issues"
    mission.last_event = "mission_done"
    db.add(Event(
        id=_uid("evt"),
        mission_id=mission.id,
        kind="mission_done",
        payload_json=json.dumps({"result": final_text}),
    ))
    db.commit()
    return {"final": final_text, "steps": step_outputs, "events": events}

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
