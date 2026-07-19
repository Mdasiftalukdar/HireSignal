from __future__ import annotations

import enum

from sqlalchemy import Enum, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class ApplicationStatus(str, enum.Enum):
    """Pipeline stages for a single job application."""

    applied = "applied"
    screening = "screening"
    technical = "technical"
    offer = "offer"
    rejected = "rejected"


class Application(Base, TimestampMixin):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    # B-tree indexes on FK columns keep joins/filters by job or resume fast.
    job_id: Mapped[int] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), index=True
    )
    resume_id: Mapped[int] = mapped_column(
        ForeignKey("resumes.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(ApplicationStatus, name="application_status"),
        default=ApplicationStatus.applied,
        server_default=ApplicationStatus.applied.value,
        index=True,
    )
    match_score: Mapped[int | None] = mapped_column(Integer)  # 0-100, set by AI later
    notes: Mapped[str | None] = mapped_column(Text)

    job: Mapped[Job] = relationship(back_populates="applications")
    resume: Mapped[Resume] = relationship(back_populates="applications")
