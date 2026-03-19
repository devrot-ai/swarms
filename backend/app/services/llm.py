import json
from app.core.config import settings

def _keyword_plan(prompt: str):
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

def generate_plan(prompt: str) -> dict:
    """Return a mission plan. Uses OpenAI only when enabled, otherwise deterministic fallback."""
    if not settings.enable_llm or not settings.openai_api_key:
        return _keyword_plan(prompt)

    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.openai_api_key)
        system = (
            "You are a mission planner for an autonomous enterprise workflow system. "
            "Return ONLY valid JSON with keys: title, goal, steps. "
            "Each step must contain tool, input, reason."
        )
        response = client.responses.create(
            model=settings.openai_model,
            input=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
        )
        text = getattr(response, "output_text", None)
        if not text:
            return _keyword_plan(prompt)
        data = json.loads(text)
        if not isinstance(data, dict):
            return _keyword_plan(prompt)
        return data
    except Exception:
        return _keyword_plan(prompt)

def synthesize_final_answer(goal: str, step_outputs: list[dict]) -> str:
    if not settings.enable_llm or not settings.openai_api_key:
        last = step_outputs[-1]["output"] if step_outputs else {}
        return f"Completed workflow for: {goal}. Final state: {json.dumps(last, ensure_ascii=False)}"

    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.openai_api_key)
        response = client.responses.create(
            model=settings.openai_model,
            input=[
                {"role": "system", "content": "Summarize the workflow outcome in concise enterprise language."},
                {"role": "user", "content": json.dumps({"goal": goal, "step_outputs": step_outputs})},
            ],
        )
        return getattr(response, "output_text", "") or f"Completed workflow for: {goal}"
    except Exception:
        return f"Completed workflow for: {goal}"
