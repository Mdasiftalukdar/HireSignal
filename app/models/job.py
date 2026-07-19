from __future__ import annotations

from sqlalchemy import Boolean, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Job(Base, TimestampMixin):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    company: Mapped[str] = mapped_column(String(255), index=True)
    location: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    # Unique so we can cache parsed results by URL later (Phase 4/6).
    url: Mapped[str | None] = mapped_column(String(1024), unique=True)
    seniority: Mapped[str | None] = mapped_column(String(50))
    salary_min: Mapped[int | None] = mapped_column(Integer)
    salary_max: Mapped[int | None] = mapped_column(Integer)
    source: Mapped[str | None] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true")
    )

    applications: Mapped[list[Application]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )

    __table_args__ = (
        # PARTIAL INDEX: index only active jobs. Smaller and faster to maintain
        # than a full index because inactive rows are excluded entirely.
        Index(
            "ix_jobs_active_created",
            "created_at",
            postgresql_where=text("is_active = true"),
        ),
    )
