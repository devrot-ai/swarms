"""JWT authentication service: token creation, user extraction, role guards."""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Annotated
from fastapi import Depends, Header
from pydantic import BaseModel
from app.core.config import settings
from app.core.exceptions import AuthenticationError, AuthorizationError

try:
    import jwt
except ImportError:  # pragma: no cover
    jwt = None  # type: ignore[assignment]


class CurrentUser(BaseModel):
    user_id: str
    role: str = "user"


# ── Hardcoded users for MVP (swap with DB lookup later) ──
_MVP_USERS: dict[str, dict] = {
    "admin": {"password": "admin", "role": "admin"},
    "user": {"password": "user", "role": "user"},
}


def authenticate_user(username: str, password: str) -> CurrentUser | None:
    """Validate credentials against the MVP user store."""
    entry = _MVP_USERS.get(username)
    if entry and entry["password"] == password:
        return CurrentUser(user_id=username, role=entry["role"])
    return None


def create_access_token(user_id: str, role: str = "user") -> str:
    """Sign a JWT with configurable secret and expiry."""
    if jwt is None:
        raise AuthenticationError("PyJWT is not installed.")
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT, returning the payload."""
    if jwt is None:
        raise AuthenticationError("PyJWT is not installed.")
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("Token has expired.")
    except jwt.InvalidTokenError:
        raise AuthenticationError("Invalid token.")


def get_current_user(authorization: Annotated[str | None, Header()] = None) -> CurrentUser:
    """FastAPI dependency that extracts the current user from the Authorization header."""
    if not authorization:
        raise AuthenticationError("Missing Authorization header.")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AuthenticationError("Authorization header must be 'Bearer <token>'.")
    payload = decode_token(parts[1])
    return CurrentUser(user_id=payload["sub"], role=payload.get("role", "user"))


def require_role(*allowed_roles: str):
    """Return a FastAPI dependency that enforces role-based access."""
    def _checker(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role not in allowed_roles:
            raise AuthorizationError(f"Role '{current_user.role}' is not permitted. Required: {allowed_roles}")
        return current_user
    return _checker
