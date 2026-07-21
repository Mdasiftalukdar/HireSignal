from __future__ import annotations

import enum

from sqlalchemy import Enum, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class AnalysisStatus(str, enum.Enum):
    """Lifecycle of an async analysis job."""

    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class Analysis(Base, TimestampMixin):
    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
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
    # Result (populated by the background worker when completed)
    match_score: Mapped[int | None] = mapped_column(Integer)
    matched_skills: Mapped[list | None] = mapped_column(JSONB)
    missing_skills: Mapped[list | None] = mapped_column(JSONB)
    recommendation: Mapped[str | None] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(Text)

    resume: Mapped["Resume"] = relationship()
