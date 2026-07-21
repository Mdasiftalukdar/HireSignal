"""Pydantic schemas for the async analysis flow."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.analysis import AnalysisStatus


class AnalysisSubmitResponse(BaseModel):
    analysis_id: int
    resume_id: int
    status: AnalysisStatus
    s3_key: str


class AnalysisRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    resume_id: int
    status: AnalysisStatus
    match_score: int | None = None
    matched_skills: list[str] | None = None
    missing_skills: list[str] | None = None
    recommendation: str | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime
