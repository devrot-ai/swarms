"""Auth routes: login and whoami."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from app.services.auth import authenticate_user, create_access_token, get_current_user, CurrentUser
from app.core.exceptions import AuthenticationError
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.user_keys import ensure_user_exists

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/token", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(payload.username, payload.password)
    if not user:
        raise AuthenticationError("Invalid username or password.")
    ensure_user_exists(db, user.user_id)
    token = create_access_token(user.user_id, user.role)
    return TokenResponse(access_token=token)


@router.get("/me")
def whoami(current_user: CurrentUser = Depends(get_current_user)):
    return {"user_id": current_user.user_id, "role": current_user.role}
