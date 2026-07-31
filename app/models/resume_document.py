from __future__ import annotations

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class ResumeDocument(Base, TimestampMixin):
    """The structured résumé the user edits in the R3 editor.

    One document per user (server-side persistence for the WYSIWYG editor, so it
    syncs across devices instead of living only in the browser's localStorage).
    The whole document is stored as a single JSONB blob - the app owns its shape.
    """

    __tablename__ = "resume_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )
    data: Mapped[dict] = mapped_column(JSONB, nullable=False)
