from pydantic import BaseModel, Field
from typing import Literal, Any

class AgentRunRequest(BaseModel):
    user_id: str | None = None
    input: str = Field(min_length=1)
    mode: Literal["chat", "workflow"] = "workflow"
    stream: bool = False

class ProposalCreateRequest(BaseModel):
    user_id: str | None = None
    prompt: str = Field(min_length=1)

class PolicyUpdateRequest(BaseModel):
    value: str

class EventIngestRequest(BaseModel):
    mission_id: str | None = None
    kind: str
    payload: dict[str, Any]

class ToolStep(BaseModel):
    tool: str
    input: dict[str, Any] = Field(default_factory=dict)
    reason: str = ""

class PlanResponse(BaseModel):
    title: str
    goal: str
    steps: list[ToolStep]

class AgentRunResponse(BaseModel):
    proposal_id: str
    mission_id: str | None
    status: str
    response: str
    steps: list[dict]
    events: list[dict]
    approved: bool

class StateResponse(BaseModel):
    proposal: dict | None
    mission: dict | None
    steps: list[dict]
    events: list[dict]
    policies: dict[str, str]
