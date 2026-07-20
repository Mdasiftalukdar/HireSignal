"""Pydantic schemas for Application (API shape).

Reuses the ApplicationStatus enum from the model so the API and DB share one source
of truth for valid pipeline stages. `match_score` is constrained to 0-100.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.application import ApplicationStatus


class ApplicationBase(BaseModel):
    job_id: int
    resume_id: int
    status: ApplicationStatus = ApplicationStatus.applied
    match_score: int | None = Field(default=None, ge=0, le=100)
    notes: str | None = None


class ApplicationCreate(ApplicationBase):
    """Fields accepted when creating an application."""


class ApplicationUpdate(BaseModel):
    # job_id / resume_id are intentionally NOT updatable - an application is tied to
    # the pairing it was created with; you change its status, score, or notes.
    status: ApplicationStatus | None = None
    match_score: int | None = Field(default=None, ge=0, le=100)
    notes: str | None = None


class ApplicationRead(ApplicationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
