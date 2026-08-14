"""One-time passcodes for email verification.

Stored in Redis (hashed) with a TTL, so they auto-expire and no OTP table is needed.
"""

import hashlib
import secrets

from app.core.cache import redis_client
from app.core.config import settings


def _key(email: str, purpose: str = "verify") -> str:
    # `purpose` namespaces the code so an email-verification OTP can't be replayed
    # to reset a password (and vice versa) - each flow has its own Redis key.
    return f"otp:{purpose}:{email.lower()}"


def _hash(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


async def create_otp(email: str, purpose: str = "verify") -> str:
    code = f"{secrets.randbelow(1_000_000):06d}"
    await redis_client.set(_key(email, purpose), _hash(code), ex=settings.otp_ttl_seconds)
    return code


async def verify_otp(email: str, code: str, purpose: str = "verify") -> bool:
    key = _key(email, purpose)
    stored = await redis_client.get(key)
    if stored is not None and secrets.compare_digest(stored, _hash(code)):
        await redis_client.delete(key)
        return True
    return False
