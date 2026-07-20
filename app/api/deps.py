"""Shared FastAPI dependencies - authentication.

`get_current_user` is injected into protected routes. It reads the Bearer token,
verifies the JWT, and loads the matching user - or raises 401.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User

# tokenUrl points at the login endpoint; it also powers the "Authorize" button in /docs.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    subject = decode_token(token)
    try:
        user_id = int(subject) if subject is not None else None
    except (TypeError, ValueError):
        user_id = None
    if user_id is None:
        raise credentials_exc
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise credentials_exc
    return user
