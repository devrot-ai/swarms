"""Planner agent: converts a user prompt into a structured mission plan."""
from __future__ import annotations
import json
import logging
from app.core.config import settings
from app.services.llm import generate, GenerateRequest
from app.tools.schemas import get_tool_definitions

logger = logging.getLogger("swarms.planner")


def _build_tool_manifest_text() -> str:
    """Build a text description of available tools for the LLM system prompt."""
    defs = get_tool_definitions()
    lines = []
    for d in defs:
        lines.append(f"- **{d.name}**: {d.description}")
        lines.append(f"  Input schema: {json.dumps(d.input_schema, indent=2)}")
    return "\n".join(lines)


def _keyword_plan(prompt: str) -> dict:
    """Deterministic fallback planner that uses keyword matching."""
    p = prompt.lower()
    title = "Autonomous workflow mission"
    steps = []

    if any(k in p for k in ["email", "reply", "inbox"]):
        title = "Email workflow"
        steps = [
            {"tool": "retrieve_context", "input": {"source": "memory"}, "reason": "Load context"},
            {"tool": "draft_message", "input": {"tone": "professional"}, "reason": "Prepare draft"},
            {"tool": "approval_gate", "input": {"risk": "medium"}, "reason": "Confirm before sending"},
        ]
    elif any(k in p for k in ["report", "analysis", "summary", "dashboard"]):
        title = "Analysis workflow"
        steps = [
            {"tool": "retrieve_context", "input": {"source": "knowledge_base"}, "reason": "Fetch relevant docs"},
            {"tool": "analyze", "input": {"depth": "deep"}, "reason": "Synthesize insight"},
            {"tool": "publish", "input": {"channel": "dashboard"}, "reason": "Surface result"},
        ]
    else:
        steps = [
            {"tool": "retrieve_context", "input": {"source": "knowledge_base"}, "reason": "Ground in context"},
            {"tool": "plan_actions", "input": {"objective": prompt}, "reason": "Break task down"},
            {"tool": "execute_actions", "input": {"limit": 3}, "reason": "Run the steps"},
        ]

    return {"title": title, "goal": prompt, "steps": steps}


class Planner:
    """Generates a structured mission plan from a user prompt."""

    def generate_plan(self, prompt: str, context: list[str] | None = None) -> dict:
        """Return a mission plan. Uses routed LLM providers when enabled."""
        if not settings.enable_llm:
            return _keyword_plan(prompt)

        try:
            tool_manifest = _build_tool_manifest_text()
            context_block = ""
            if context:
                context_block = "\n\nRelevant context:\n" + "\n".join(f"- {c}" for c in context)

            system = (
                "You are a mission planner for an autonomous enterprise workflow system.\n"
                "Available tools:\n"
                f"{tool_manifest}\n\n"
                "Return ONLY valid JSON with keys: title, goal, steps.\n"
                "Each step must contain: tool (one of the available tools), input (matching the tool's schema), reason."
            )
            user_content = prompt + context_block

            text = generate(
                GenerateRequest(
                    model=settings.openai_model,
                    prompt=user_content,
                    temperature=0.1,
                    system_prompt=system,
                )
            )
            if not text:
                return _keyword_plan(prompt)
            data = json.loads(text)
            if not isinstance(data, dict):
                return _keyword_plan(prompt)
            return data
        except Exception as exc:
            logger.warning("Planner LLM call failed, falling back to keyword plan: %s", exc)
            return _keyword_plan(prompt)
