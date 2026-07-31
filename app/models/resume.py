from __future__ import annotations

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Resume(Base, TimestampMixin):
    __tablename__ = "resumes"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Owner (null for legacy/seed rows). A user keeps at most `max_saved_resumes`
    # SAVED résumés - those are the ones with a `label` and a stored file.
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    label: Mapped[str | None] = mapped_column(String(100))  # set => a saved résumé
    filename: Mapped[str] = mapped_column(String(255))
    # Extracted plain text (cheap to keep; the RAG pipeline embeds it).
    content_text: Mapped[str | None] = mapped_column(Text)
    # Object-storage key - only saved résumés get a stored file (bounds storage cost).
    s3_key: Mapped[str | None] = mapped_column(String(1024))

    applications: Mapped[list[Application]] = relationship(
        back_populates="resume", cascade="all, delete-orphan"
    )
