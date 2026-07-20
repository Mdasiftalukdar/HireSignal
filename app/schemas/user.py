"""Pydantic schemas for users and auth tokens.

Note `UserRead` has no password field of any kind - the hash never leaves the server.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    # bcrypt hashes at most 72 bytes; enforce a sane range here.
    password: str = Field(min_length=8, max_length=72)
    full_name: str | None = None


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str | None = None
    is_active: bool
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
