"""API routes: agent, proposals, missions, events, policies, tools, state."""
import json
from datetime import datetime
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.schemas.contracts import AgentRunRequest, ProposalCreateRequest, PolicyUpdateRequest, EventIngestRequest
from app.services.orchestrator import (
    run_closed_loop,
    run_closed_loop_stream,
    create_proposal,
    create_mission_from_proposal,
    execute_mission,
    state_snapshot,
    recover_stale_missions,
)
from app.services.policy import set_policy
from app.services.auth import get_current_user, CurrentUser
from app.models.entities import Proposal, Mission, Event
from app.tools.schemas import get_tool_definitions

router = APIRouter()


def _uid(prefix: str) -> str:
    return f"{prefix}_{datetime.utcnow().timestamp()}".replace(".", "")


# ── Public routes ───────────────────────────────────────────────────

@router.get("/health")
def health():
    return {"ok": True, "service": "swarms-backend"}


@router.get("/tools")
def list_tools():
    """Return the JSON-Schema manifest of all registered tools."""
    return [d.model_dump() for d in get_tool_definitions()]


# ── Protected routes ────────────────────────────────────────────────

@router.post("/agent/run")
def agent_run(
    payload: AgentRunRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    if not payload.user_id:
        payload.user_id = current_user.user_id
    return run_closed_loop(db, payload)


@router.post("/agent/stream")
def agent_stream(
    payload: AgentRunRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    if not payload.user_id:
        payload.user_id = current_user.user_id
    return StreamingResponse(run_closed_loop_stream(db, payload), media_type="text/event-stream")


@router.post("/proposals")
def create_proposal_route(
    payload: ProposalCreateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    proposal = create_proposal(db, payload.user_id or current_user.user_id, payload.prompt)
    return {
        "id": proposal.id,
        "user_id": proposal.user_id,
        "prompt": proposal.prompt,
        "summary": proposal.summary,
        "status": proposal.status,
        "approved": proposal.approved,
        "mission_id": proposal.mission_id,
    }


@router.post("/proposals/{proposal_id}/approve")
def approve_proposal(
    proposal_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    proposal = db.get(Proposal, proposal_id)
    if not proposal:
        raise NotFoundError("Proposal", proposal_id)
    proposal.approved = True
    proposal.status = "approved"
    db.commit()
    db.refresh(proposal)
    mission, plan = create_mission_from_proposal(db, proposal)
    return {"proposal_id": proposal.id, "mission_id": mission.id, "plan": plan}


@router.post("/missions/{mission_id}/execute")
def execute_mission_route(
    mission_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    mission = db.get(Mission, mission_id)
    if not mission:
        raise NotFoundError("Mission", mission_id)
    proposal = db.get(Proposal, mission.proposal_id)
    from app.agents.planner import Planner
    plan = Planner().generate_plan(proposal.prompt if proposal else mission.goal)
    return execute_mission(db, mission, plan)


@router.post("/events/ingest")
def ingest_event(
    payload: EventIngestRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    event = Event(
        id=_uid("evt"),
        mission_id=payload.mission_id,
        kind=payload.kind,
        payload_json=json.dumps(payload.payload),
    )
    db.add(event)
    db.commit()
    return {"ok": True, "event_id": event.id}


@router.patch("/policies/{key}")
def patch_policy(
    key: str,
    payload: PolicyUpdateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    row = set_policy(db, key, payload.value)
    return {"key": row.key, "value": row.value}


@router.get("/state")
def state(
    proposal_id: str | None = None,
    mission_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    return state_snapshot(db, proposal_id=proposal_id, mission_id=mission_id)


@router.get("/state/{proposal_or_mission_id}")
def state_by_id(
    proposal_or_mission_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    return state_snapshot(db, proposal_id=proposal_or_mission_id, mission_id=proposal_or_mission_id)


@router.post("/workers/recover-stale")
def recover_stale(
    db: Session = Depends(get_db),
    minutes: int = 30,
    current_user: CurrentUser = Depends(get_current_user),
):
    return {"recovered": recover_stale_missions(db, minutes=minutes)}
