from __future__ import annotations

import enum

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class AnalysisStatus(str, enum.Enum):
    """Lifecycle of an async analysis job."""

    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class DecisionStatus(str, enum.Enum):
    """User-set outcome of an application (for the usage tracker)."""

    under_review = "under_review"
    selected = "selected"
    not_selected = "not_selected"


class Analysis(Base, TimestampMixin):
    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    resume_id: Mapped[int] = mapped_column(
        ForeignKey("resumes.id", ondelete="CASCADE"), index=True
    )
    job_description: Mapped[str] = mapped_column(Text)
    status: Mapped[AnalysisStatus] = mapped_column(
        Enum(AnalysisStatus, name="analysis_status"),
        default=AnalysisStatus.pending,
        server_default=AnalysisStatus.pending.value,
        index=True,
    )
    # Result (populated by the worker when completed)
    match_score: Mapped[int | None] = mapped_column(Integer)
    matched_skills: Mapped[list | None] = mapped_column(JSONB)
    missing_skills: Mapped[list | None] = mapped_column(JSONB)
    recommendation: Mapped[str | None] = mapped_column(Text)
    keyword_matches: Mapped[list | None] = mapped_column(JSONB)
    keyword_gaps: Mapped[list | None] = mapped_column(JSONB)
    section_suggestions: Mapped[list | None] = mapped_column(JSONB)
    weaknesses: Mapped[list | None] = mapped_column(JSONB)
    suggested_bullets: Mapped[list | None] = mapped_column(JSONB)
    # Brief summaries kept for the usage tracker (cheap text, no files)
    resume_summary: Mapped[str | None] = mapped_column(Text)
    job_summary: Mapped[str | None] = mapped_column(Text)
    # User-set tracking fields
    applied: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false")
    )
    decision: Mapped[DecisionStatus | None] = mapped_column(
        Enum(DecisionStatus, name="decision_status")
    )
    error: Mapped[str | None] = mapped_column(Text)

    resume: Mapped["Resume"] = relationship()
