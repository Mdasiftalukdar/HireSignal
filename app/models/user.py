from __future__ import annotations

from sqlalchemy import Boolean, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Unique + indexed: fast login lookups and no duplicate accounts.
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    # bcrypt HASH (never the raw password). Null for OAuth-only accounts.
    hashed_password: Mapped[str | None] = mapped_column(String(255))
    full_name: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true")
    )
    # True once verified via email OTP or an OAuth provider.
    email_verified: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true")
    )
    auth_provider: Mapped[str | None] = mapped_column(String(20))  # 'email' | 'google'
    # Bring-your-own LLM key, encrypted at rest (bypasses the daily free limit).
    encrypted_api_key: Mapped[str | None] = mapped_column(Text)
    api_provider: Mapped[str | None] = mapped_column(String(50))
