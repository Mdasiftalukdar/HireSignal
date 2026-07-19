from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Resume(Base, TimestampMixin):
    __tablename__ = "resumes"

    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(255))
    # Extracted plain text, populated by the RAG pipeline (Phase 5).
    content_text: Mapped[str | None] = mapped_column(Text)
    # Object-storage key for the uploaded file (Phase 6).
    s3_key: Mapped[str | None] = mapped_column(String(1024))

    applications: Mapped[list[Application]] = relationship(
        back_populates="resume", cascade="all, delete-orphan"
    )
