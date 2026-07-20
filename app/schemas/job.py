"""Pydantic schemas for Job = the API's shape of a job (vs. the ORM model = DB shape).

- *Create* / *Update* describe what clients may SEND.
- *Read* describes what the API RETURNS (includes server-managed fields like id/timestamps).
Keeping these separate from the ORM model means clients can never set server-owned fields
(id, created_at) and we never leak internal columns we don't want to expose.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class JobBase(BaseModel):
    title: str
    company: str
    location: str | None = None
    description: str | None = None
    url: str | None = None
    seniority: str | None = None
    salary_min: int | None = None
    salary_max: int | None = None
    source: str | None = None
    is_active: bool = True


class JobCreate(JobBase):
    """Fields accepted when creating a job."""


class JobUpdate(BaseModel):
    """All optional: a PATCH updates only the fields provided."""

    title: str | None = None
    company: str | None = None
    location: str | None = None
    description: str | None = None
    url: str | None = None
    seniority: str | None = None
    salary_min: int | None = None
    salary_max: int | None = None
    source: str | None = None
    is_active: bool | None = None


class JobRead(JobBase):
    # from_attributes lets Pydantic build this straight from a SQLAlchemy model instance.
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
