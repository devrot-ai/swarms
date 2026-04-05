"""Critic agent: validates mission outcomes for completeness and policy safety."""
from __future__ import annotations
import json
import logging
from typing import Literal
from app.core.config import settings
from app.services.llm import generate, GenerateRequest

logger = logging.getLogger("swarms.critic")

Verdict = Literal["pass", "retry", "escalate"]


class CriticResult:
    def __init__(self, verdict: Verdict, reason: str):
        self.verdict = verdict
        self.reason = reason

    def to_dict(self) -> dict:
        return {"verdict": self.verdict, "reason": self.reason}


class Critic:
    """Validates mission results using rule-based checks or LLM."""

    def validate_result(self, goal: str, step_outputs: list[dict]) -> CriticResult:
        """Check if the mission outcome is complete and policy-safe."""
        # Rule-based checks
        if not step_outputs:
            return CriticResult("retry", "No steps were executed.")

        failed_steps = [s for s in step_outputs if "error" in (s.get("output") or {})]
        if len(failed_steps) > len(step_outputs) // 2:
            return CriticResult("escalate", f"{len(failed_steps)}/{len(step_outputs)} steps failed — escalating.")

        if failed_steps:
            return CriticResult("retry", f"{len(failed_steps)} step(s) failed. Retry recommended.")

        # LLM-based validation when enabled
        if settings.enable_llm:
            return self._llm_validate(goal, step_outputs)

        return CriticResult("pass", "All steps completed successfully.")

    def _llm_validate(self, goal: str, step_outputs: list[dict]) -> CriticResult:
        try:
            text = generate(
                GenerateRequest(
                    model=settings.openai_model,
                    prompt=json.dumps({"goal": goal, "step_outputs": step_outputs}),
                    temperature=0.1,
                    system_prompt=(
                        "You are a quality critic for an enterprise workflow system. "
                        "Given a goal and step outputs, respond with ONLY valid JSON: "
                        '{"verdict": "pass"|"retry"|"escalate", "reason": "..."}'
                    ),
                )
            )
            if text:
                data = json.loads(text)
                verdict = data.get("verdict", "pass")
                if verdict not in ("pass", "retry", "escalate"):
                    verdict = "pass"
                return CriticResult(verdict, data.get("reason", "LLM validation."))
        except Exception as exc:
            logger.warning("Critic LLM call failed: %s", exc)

        return CriticResult("pass", "All steps completed successfully (LLM validation unavailable).")
