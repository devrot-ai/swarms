"""Provider-agnostic LLM service with OpenAI, Anthropic, and Ollama support."""
from __future__ import annotations

import json
from dataclasses import dataclass
from sqlalchemy.orm import Session
import httpx
from app.core.config import settings
from app.services.user_keys import get_user_api_key


@dataclass
class GenerateRequest:
    model: str
    prompt: str
    temperature: float = 0.2
    api_key: str | None = None
    user_id: str | None = None
    db: Session | None = None
    system_prompt: str | None = None


def _keyword_plan(prompt: str) -> dict:
    p = prompt.lower()
    title = "Autonomous workflow mission"

    if any(k in p for k in ["email", "reply", "inbox"]):
        return {
            "title": "Email workflow",
            "goal": prompt,
            "steps": [
                {"tool": "retrieve_context", "input": {"source": "memory"}, "reason": "Load context"},
                {"tool": "draft_message", "input": {"tone": "professional"}, "reason": "Prepare draft"},
                {"tool": "approval_gate", "input": {"risk": "medium"}, "reason": "Confirm before sending"},
            ],
        }
    if any(k in p for k in ["report", "analysis", "summary", "dashboard"]):
        return {
            "title": "Analysis workflow",
            "goal": prompt,
            "steps": [
                {"tool": "retrieve_context", "input": {"source": "knowledge_base"}, "reason": "Fetch relevant docs"},
                {"tool": "analyze", "input": {"depth": "deep"}, "reason": "Synthesize insight"},
                {"tool": "publish", "input": {"channel": "dashboard"}, "reason": "Surface result"},
            ],
        }

    return {
        "title": title,
        "goal": prompt,
        "steps": [
            {"tool": "retrieve_context", "input": {"source": "knowledge_base"}, "reason": "Ground in context"},
            {"tool": "plan_actions", "input": {"objective": prompt}, "reason": "Break task down"},
            {"tool": "execute_actions", "input": {"limit": 3}, "reason": "Run the steps"},
        ],
    }


def _provider_from_model(model: str) -> str:
    value = (model or "").lower()
    if value.startswith("claude"):
        return "anthropic"
    if value.startswith("ollama/") or value.startswith("llama") or value.startswith("mistral"):
        return "ollama"
    return "openai"


def _resolve_api_key(
    provider: str,
    explicit_api_key: str | None,
    db: Session | None,
    user_id: str | None,
) -> str | None:
    if explicit_api_key:
        return explicit_api_key
    if db and user_id:
        user_key = get_user_api_key(db, user_id, provider)
        if user_key:
            return user_key
    if provider == "anthropic":
        return settings.anthropic_api_key
    return settings.openai_api_key


def _generate_openai(model: str, prompt: str, api_key: str, temperature: float, system_prompt: str | None) -> str:
    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    input_messages = []
    if system_prompt:
        input_messages.append({"role": "system", "content": system_prompt})
    input_messages.append({"role": "user", "content": prompt})

    response = client.responses.create(
        model=model,
        input=input_messages,
        temperature=temperature,
    )
    return getattr(response, "output_text", "") or ""


def _generate_anthropic(model: str, prompt: str, api_key: str, temperature: float, system_prompt: str | None) -> str:
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    payload = {
        "model": model,
        "max_tokens": 1024,
        "temperature": temperature,
        "messages": [{"role": "user", "content": prompt}],
    }
    if system_prompt:
        payload["system"] = system_prompt

    with httpx.Client(timeout=30.0) as client:
        resp = client.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
    content = data.get("content") or []
    if content and isinstance(content, list):
        first = content[0]
        if isinstance(first, dict):
            return first.get("text", "")
    return ""


def _generate_ollama(model: str, prompt: str, temperature: float, system_prompt: str | None) -> str:
    normalized_model = model.split("/", 1)[1] if model.startswith("ollama/") else model
    body = {
        "model": normalized_model or settings.ollama_model,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": temperature},
    }
    if system_prompt:
        body["system"] = system_prompt

    with httpx.Client(timeout=60.0) as client:
        resp = client.post(f"{settings.ollama_base_url.rstrip('/')}/api/generate", json=body)
        resp.raise_for_status()
        data = resp.json()
    return data.get("response", "")


def generate(req: GenerateRequest) -> str:
    provider = _provider_from_model(req.model)
    if not settings.enable_llm:
        return ""

    api_key = _resolve_api_key(provider, req.api_key, req.db, req.user_id)

    if provider == "openai" and api_key:
        return _generate_openai(req.model, req.prompt, api_key, req.temperature, req.system_prompt)
    if provider == "anthropic" and api_key:
        return _generate_anthropic(req.model, req.prompt, api_key, req.temperature, req.system_prompt)
    if provider == "ollama":
        return _generate_ollama(req.model, req.prompt, req.temperature, req.system_prompt)

    return ""


def generate_plan(prompt: str, db: Session | None = None, user_id: str | None = None) -> dict:
    """Return a mission plan using configured model routing when available."""
    try:
        text = generate(
            GenerateRequest(
                model=settings.openai_model,
                prompt=prompt,
                temperature=0.1,
                db=db,
                user_id=user_id,
                system_prompt=(
                    "You are a mission planner for an autonomous enterprise workflow system. "
                    "Return ONLY valid JSON with keys: title, goal, steps. "
                    "Each step must contain tool, input, reason."
                ),
            )
        )
        if not text:
            return _keyword_plan(prompt)
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    return _keyword_plan(prompt)


def synthesize_final_answer(goal: str, step_outputs: list[dict], db: Session | None = None, user_id: str | None = None) -> str:
    fallback = f"Completed workflow for: {goal}. Final state: {json.dumps(step_outputs[-1]['output'] if step_outputs else {})}"
    try:
        text = generate(
            GenerateRequest(
                model=settings.openai_model,
                prompt=json.dumps({"goal": goal, "step_outputs": step_outputs}),
                temperature=0.2,
                db=db,
                user_id=user_id,
                system_prompt="Summarize the workflow outcome in concise enterprise language.",
            )
        )
        return text or fallback
    except Exception:
        return fallback
