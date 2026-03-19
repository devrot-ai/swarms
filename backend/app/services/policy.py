import json
from sqlalchemy.orm import Session
from app.models.entities import Policy
from app.core.config import settings

DEFAULT_POLICIES = {
    "auto_approve": "true",
    "worker_policy": "allow_all",
    "x_daily_quota": "100",
    "reaction_matrix": json.dumps({
        "on_step_success": ["emit_progress"],
        "on_step_failure": ["diagnose_failure"],
        "on_mission_done": ["finalize"]
    })
}

def bootstrap_policies(db: Session):
    changed = False
    for key, value in DEFAULT_POLICIES.items():
        existing = db.get(Policy, key)
        if not existing:
            db.add(Policy(key=key, value=value))
            changed = True
    if changed:
        db.commit()

def get_policy(db: Session, key: str) -> str | None:
    row = db.get(Policy, key)
    if row:
        return row.value
    if key == "auto_approve":
        return "true" if settings.auto_approve else "false"
    if key == "worker_policy":
        return settings.worker_policy
    return None

def set_policy(db: Session, key: str, value: str):
    row = db.get(Policy, key)
    if not row:
        row = Policy(key=key, value=value)
        db.add(row)
    else:
        row.value = value
    db.commit()
    return row
