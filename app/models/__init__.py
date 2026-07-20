"""Importing this package registers every model on `Base.metadata`.

Alembic's env.py imports it so autogenerate can see all tables.
"""

from app.models.application import Application, ApplicationStatus
from app.models.job import Job
from app.models.resume import Resume
from app.models.user import User

__all__ = ["Job", "Resume", "Application", "ApplicationStatus", "User"]
