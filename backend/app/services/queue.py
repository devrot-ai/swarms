"""Task queue and event bus abstractions backed by Redis when enabled."""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.entities import Task

logger = logging.getLogger("swarms.queue")

try:
    import redis
except ImportError:  # pragma: no cover
    redis = None  # type: ignore[assignment]

_MEMORY_QUEUE: dict[str, list[dict[str, Any]]] = {}
_MEMORY_EVENTS: list[dict[str, Any]] = []


def _uid(prefix: str) -> str:
    return f"{prefix}_{datetime.utcnow().timestamp()}".replace(".", "")


def _redis_client():
    if not settings.enable_redis or redis is None:
        return None
    try:
        client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
        client.ping()
        return client
    except Exception as exc:
        logger.warning("Redis unavailable, using in-memory queue fallback: %s", exc)
        return None


def enqueue_task(
    db: Session,
    mission_id: str | None,
    agent_id: str | None,
    payload: dict[str, Any],
    queue_name: str | None = None,
    max_retries: int = 2,
) -> Task:
    queue = queue_name or settings.queue_name
    row = Task(
        id=_uid("task"),
        mission_id=mission_id,
        agent_id=agent_id,
        status="pending",
        task_type="tool_step",
        input_json=json.dumps(payload),
        result_json=None,
        error=None,
        retries=0,
        max_retries=max_retries,
        queue_name=queue,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    data = {"task_id": row.id, "mission_id": mission_id, "agent_id": agent_id, "payload": payload}
    client = _redis_client()
    if client:
        client.rpush(queue, json.dumps(data))
    else:
        _MEMORY_QUEUE.setdefault(queue, []).append(data)

    publish_event("task_enqueued", {"task_id": row.id, "queue": queue, "agent_id": agent_id})
    return row


def pop_task(queue_name: str | None = None) -> dict[str, Any] | None:
    queue = queue_name or settings.queue_name
    client = _redis_client()
    if client:
        raw = client.lpop(queue)
        if not raw:
            return None
        return json.loads(raw)

    items = _MEMORY_QUEUE.get(queue, [])
    if not items:
        return None
    return items.pop(0)


def mark_task_running(db: Session, task_id: str) -> None:
    row = db.get(Task, task_id)
    if not row:
        return
    row.status = "running"
    db.commit()


def mark_task_done(db: Session, task_id: str, result: dict[str, Any]) -> None:
    row = db.get(Task, task_id)
    if not row:
        return
    row.status = "done"
    row.result_json = json.dumps(result)
    row.error = None
    db.commit()
    publish_event("task_done", {"task_id": task_id})


def mark_task_failed(db: Session, task_id: str, error: str) -> None:
    row = db.get(Task, task_id)
    if not row:
        return
    row.retries += 1
    row.error = error
    row.status = "pending" if row.retries <= row.max_retries else "failed"
    db.commit()
    publish_event("task_failed", {"task_id": task_id, "retries": row.retries, "error": error})


def publish_event(kind: str, payload: dict[str, Any], channel: str = "agent_events") -> None:
    message = {"kind": kind, "payload": payload}
    client = _redis_client()
    if client:
        client.publish(channel, json.dumps(message))
    else:
        _MEMORY_EVENTS.append(message)


def read_local_events() -> list[dict[str, Any]]:
    # Useful in tests when Redis is disabled.
    return list(_MEMORY_EVENTS)
