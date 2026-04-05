"""Symmetric encryption helpers for storing sensitive user credentials."""
from __future__ import annotations

import base64
import hashlib
from cryptography.fernet import Fernet
from app.core.config import settings


def _derive_fernet_key(secret: str) -> bytes:
    # Fernet expects a URL-safe base64-encoded 32-byte key.
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _cipher() -> Fernet:
    return Fernet(_derive_fernet_key(settings.api_key_encryption_secret))


def encrypt_text(raw: str) -> str:
    return _cipher().encrypt(raw.encode("utf-8")).decode("utf-8")


def decrypt_text(token: str) -> str:
    return _cipher().decrypt(token.encode("utf-8")).decode("utf-8")
