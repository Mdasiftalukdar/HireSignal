"""Pydantic schemas for the async analysis flow."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.analysis import AnalysisStatus, DecisionStatus


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
    keyword_matches: list[str] | None = None
    keyword_gaps: list[str] | None = None
    section_suggestions: list[str] | None = None
    weaknesses: list[str] | None = None
    suggested_bullets: list[str] | None = None
    resume_summary: str | None = None
    job_summary: str | None = None
    applied: bool = False
    decision: DecisionStatus | None = None
    recommendation: str | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime
