"""Symmetric encryption for secrets at rest (users' bring-your-own LLM API keys).

The Fernet key is derived from SECRET_KEY, so there's no extra config to manage. Keys are
never stored or logged in plain text. (Rotating SECRET_KEY invalidates stored ciphertexts,
which just means users re-enter their key.)
"""

import base64
import hashlib

from cryptography.fernet import Fernet

from app.core.config import settings


def _fernet() -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.secret_key.encode()).digest())
    return Fernet(key)


def encrypt(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    return _fernet().decrypt(ciphertext.encode()).decode()
