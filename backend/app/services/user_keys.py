"""User API key storage and retrieval with at-rest encryption."""
from __future__ import annotations

import json
from sqlalchemy.orm import Session
from app.models.entities import User
from app.services.encryption import encrypt_text, decrypt_text


def _get_or_create_user(db: Session, user_id: str) -> User:
    user = db.get(User, user_id)
    if user:
        return user
    user = User(id=user_id, email=None, encrypted_api_keys=json.dumps({}))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def ensure_user_exists(db: Session, user_id: str) -> User:
    return _get_or_create_user(db, user_id)


def _read_key_map(user: User) -> dict[str, str]:
    if not user.encrypted_api_keys:
        return {}
    try:
        value = json.loads(user.encrypted_api_keys)
        return value if isinstance(value, dict) else {}
    except Exception:
        return {}


def upsert_user_api_key(db: Session, user_id: str, provider: str, api_key: str) -> None:
    user = _get_or_create_user(db, user_id)
    payload = _read_key_map(user)
    payload[provider] = encrypt_text(api_key)
    user.encrypted_api_keys = json.dumps(payload)
    db.commit()


def delete_user_api_key(db: Session, user_id: str, provider: str) -> bool:
    user = db.get(User, user_id)
    if not user:
        return False
    payload = _read_key_map(user)
    if provider not in payload:
        return False
    payload.pop(provider, None)
    user.encrypted_api_keys = json.dumps(payload)
    db.commit()
    return True


def get_user_api_key(db: Session, user_id: str, provider: str) -> str | None:
    user = db.get(User, user_id)
    if not user:
        return None
    payload = _read_key_map(user)
    token = payload.get(provider)
    if not token:
        return None
    try:
        return decrypt_text(token)
    except Exception:
        return None


def list_user_key_providers(db: Session, user_id: str) -> list[str]:
    user = db.get(User, user_id)
    if not user:
        return []
    payload = _read_key_map(user)
    return sorted(payload.keys())
