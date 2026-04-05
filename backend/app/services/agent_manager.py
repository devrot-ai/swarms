"""Agent profile lifecycle and role-based assignment helpers."""
from __future__ import annotations

import json
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.entities import AgentProfile


def _uid(prefix: str) -> str:
    return f"{prefix}_{datetime.utcnow().timestamp()}".replace(".", "")


DEFAULT_AGENTS = [
    {
        "name": "Research Agent",
        "role": "research",
        "skills": ["research", "context_gathering"],
        "model": "gpt-4.1-mini",
        "memory_scope": "project",
    },
    {
        "name": "Copywriting Agent",
        "role": "copywriter",
        "skills": ["copywriting", "seo"],
        "model": "claude-3-5-haiku-latest",
        "memory_scope": "project",
    },
    {
        "name": "Developer Agent",
        "role": "developer",
        "skills": ["coding", "implementation"],
        "model": "gpt-4.1",
        "memory_scope": "project",
    },
]


def ensure_default_agents(db: Session) -> None:
    count = db.query(AgentProfile).count()
    if count > 0:
        return
    for data in DEFAULT_AGENTS:
        db.add(
            AgentProfile(
                id=_uid("agent"),
                name=data["name"],
                role=data["role"],
                skills_json=json.dumps(data["skills"]),
                model_preference=data["model"],
                memory_scope=data["memory_scope"],
                prompt_template=(
                    "You are a senior {role} in an AI company. "
                    "Complete tasks precisely and collaborate with other agents. "
                    "Output structured JSON when possible."
                ),
                is_active=True,
            )
        )
    db.commit()


def create_agent(
    db: Session,
    name: str,
    role: str,
    skills: list[str],
    model: str | None,
    memory_scope: str,
) -> AgentProfile:
    agent = AgentProfile(
        id=_uid("agent"),
        name=name,
        role=role,
        skills_json=json.dumps(skills),
        model_preference=model,
        memory_scope=memory_scope,
        prompt_template=(
            "You are a senior {role} in an AI company. "
            "Your job is to complete tasks with precision. "
            "Collaborate with other agents. Output structured JSON only."
        ),
        is_active=True,
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


def list_agents(db: Session) -> list[AgentProfile]:
    return db.query(AgentProfile).filter(AgentProfile.is_active.is_(True)).order_by(AgentProfile.created_at.asc()).all()


def _skills(agent: AgentProfile) -> list[str]:
    try:
        skills = json.loads(agent.skills_json)
        return skills if isinstance(skills, list) else []
    except Exception:
        return []


def choose_agent_for_tool(db: Session, tool_name: str) -> AgentProfile | None:
    agents = list_agents(db)
    if not agents:
        return None

    # Lightweight routing policy that can be replaced by learned assignment later.
    desired = "implementation"
    if tool_name in ("retrieve_context", "analyze"):
        desired = "research"
    elif tool_name in ("draft_message", "publish"):
        desired = "copywriting"

    for agent in agents:
        skill_set = set(s.lower() for s in _skills(agent))
        role = (agent.role or "").lower()
        if desired in role or desired in skill_set:
            return agent

    return agents[0]


def serialize_agent(agent: AgentProfile) -> dict:
    return {
        "id": agent.id,
        "name": agent.name,
        "role": agent.role,
        "skills": _skills(agent),
        "model": agent.model_preference,
        "memory_scope": agent.memory_scope,
    }
