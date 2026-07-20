"""Password hashing and JWT creation/verification.

- Passwords are hashed with bcrypt (never stored in plain text). bcrypt is *slow by
  design* to make brute-forcing expensive, and salts every hash automatically.
- A JWT is a signed token: the server can verify it was issued here (via SECRET_KEY)
  without storing any session state. Anyone can read its contents, so we put only a
  user id and expiry inside - never secrets.
"""

from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str) -> str:
    """`subject` is the user id. The token expires after the configured minutes."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> str | None:
    """Return the subject (user id as str) if the token is valid, else None."""
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.jwt_algorithm]
        )
        return payload.get("sub")
    except JWTError:
        return None
