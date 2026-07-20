"""Pydantic schemas for Resume (API shape)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ResumeBase(BaseModel):
    filename: str
    content_text: str | None = None
    s3_key: str | None = None


class ResumeCreate(ResumeBase):
    """Fields accepted when creating a resume."""


class ResumeUpdate(BaseModel):
    filename: str | None = None
    content_text: str | None = None
    s3_key: str | None = None


class ResumeRead(ResumeBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
