"""Pydantic input models and JSON-Schema manifest for every registered tool."""
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Any


# ── Per-tool input models ──────────────────────────────────────────────

class RetrieveContextInput(BaseModel):
    source: str = Field("memory", description="Where to retrieve context from (memory, knowledge_base, etc.)")

class DraftMessageInput(BaseModel):
    tone: str = Field("professional", description="Tone of the message (professional, casual, urgent)")

class AnalyzeInput(BaseModel):
    depth: str = Field("deep", description="Analysis depth (shallow, deep)")

class PublishInput(BaseModel):
    channel: str = Field("dashboard", description="Channel to publish to")

class PlanActionsInput(BaseModel):
    objective: str = Field("", description="The objective to break down into actions")

class ExecuteActionsInput(BaseModel):
    limit: int = Field(3, ge=1, le=20, description="Maximum number of actions to execute")

class ApprovalGateInput(BaseModel):
    risk: str = Field("low", description="Risk level (low, medium, high)")


# ── Tool definition manifest ──────────────────────────────────────────

class ToolDefinition(BaseModel):
    name: str
    description: str
    input_schema: dict[str, Any]
    output_example: dict[str, Any] | None = None


INPUT_MODELS: dict[str, type[BaseModel]] = {
    "retrieve_context": RetrieveContextInput,
    "draft_message": DraftMessageInput,
    "analyze": AnalyzeInput,
    "publish": PublishInput,
    "plan_actions": PlanActionsInput,
    "execute_actions": ExecuteActionsInput,
    "approval_gate": ApprovalGateInput,
}

TOOL_DESCRIPTIONS: dict[str, str] = {
    "retrieve_context": "Fetch relevant context from memory or a knowledge base.",
    "draft_message": "Draft a professional message or email.",
    "analyze": "Analyze data or a situation and produce insights.",
    "publish": "Publish results to a dashboard or notification channel.",
    "plan_actions": "Break an objective into a list of sub-actions.",
    "execute_actions": "Execute a batch of planned actions.",
    "approval_gate": "Gate that pauses execution for approval on risky actions.",
}

OUTPUT_EXAMPLES: dict[str, dict] = {
    "retrieve_context": {"source": "memory", "facts": ["..."]},
    "draft_message": {"draft": "[professional] Draft created ..."},
    "analyze": {"insight": "The task appears suitable ..."},
    "publish": {"channel": "dashboard", "published": True},
    "plan_actions": {"objective": "...", "actions": ["..."]},
    "execute_actions": {"executed": True, "count": 3},
    "approval_gate": {"approved": True, "risk": "low"},
}


def get_tool_definitions() -> list[ToolDefinition]:
    """Return a JSON-Schema manifest of all registered tools."""
    definitions = []
    for name, model in INPUT_MODELS.items():
        definitions.append(ToolDefinition(
            name=name,
            description=TOOL_DESCRIPTIONS.get(name, ""),
            input_schema=model.model_json_schema(),
            output_example=OUTPUT_EXAMPLES.get(name),
        ))
    return definitions
