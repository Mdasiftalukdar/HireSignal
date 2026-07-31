"""One-time passcodes for email verification.

Stored in Redis (hashed) with a TTL, so they auto-expire and no OTP table is needed.
"""

import hashlib
import secrets

from app.core.cache import redis_client
from app.core.config import settings


def _key(email: str) -> str:
    return f"otp:{email.lower()}"


def _hash(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


async def create_otp(email: str) -> str:
    code = f"{secrets.randbelow(1_000_000):06d}"
    await redis_client.set(_key(email), _hash(code), ex=settings.otp_ttl_seconds)
    return code


async def verify_otp(email: str, code: str) -> bool:
    stored = await redis_client.get(_key(email))
    if stored is not None and secrets.compare_digest(stored, _hash(code)):
        await redis_client.delete(_key(email))
        return True
    return False
