"""Per-user account endpoints (Round 1): saved resumes, BYO API key, usage, tracker."""

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.crypto import encrypt
from app.db.session import get_db
from app.models.analysis import Analysis, AnalysisStatus, DecisionStatus
from app.models.resume import Resume
from app.models.resume_document import ResumeDocument
from app.models.user import User
from app.services.extract import SUPPORTED, extract_text
from app.services.rag import index_resume
from app.services.storage import delete_object, upload_bytes
from app.services.vectorstore import delete_resume

router = APIRouter(prefix="/me", tags=["me"], dependencies=[Depends(get_current_user)])

_VALID_PROVIDERS = {
    "openrouter", "openai", "anthropic", "google", "deepseek",
    "groq", "mistral", "together", "xai", "perplexity",
}


# ---------------- Saved resumes (<= max_saved_resumes) ----------------


class SavedResumeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    label: str | None
    filename: str


@router.get("/resumes", response_model=list[SavedResumeOut])
async def list_saved_resumes(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    rows = (
        await db.execute(
            select(Resume)
            .where(Resume.user_id == user.id, Resume.label.is_not(None))
            .order_by(Resume.created_at.desc())
        )
    ).scalars().all()
    return rows


@router.post("/resumes", response_model=SavedResumeOut, status_code=status.HTTP_201_CREATED)
async def save_resume(
    label: str = Form(..., min_length=1, max_length=100),
    file: UploadFile | None = File(None),
    text: str | None = Form(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = (
        await db.execute(
            select(func.count())
            .select_from(Resume)
            .where(Resume.user_id == user.id, Resume.label.is_not(None))
        )
    ).scalar_one()
    if count >= settings.max_saved_resumes:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"You can save at most {settings.max_saved_resumes} resumes. Delete one first.",
        )

    filename, s3_key = "pasted.txt", None
    if file is not None and file.filename:
        if not file.filename.lower().endswith(SUPPORTED):
            raise HTTPException(400, f"Unsupported file type. Use one of: {', '.join(SUPPORTED)}")
        data = await file.read()
        try:
            content = extract_text(file.filename, data)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        filename = file.filename
        s3_key = f"resumes/{uuid4().hex}-{filename}"
        await run_in_threadpool(
            upload_bytes, s3_key, data, file.content_type or "application/octet-stream"
        )
    elif text:
        content = text.strip()
    else:
        raise HTTPException(400, "Provide a resume file or text.")
    if not content:
        raise HTTPException(400, "Could not read any resume text.")

    resume = Resume(
        user_id=user.id, label=label, filename=filename, content_text=content, s3_key=s3_key
    )
    db.add(resume)
    await db.commit()
    await db.refresh(resume)
    await run_in_threadpool(index_resume, resume.id, content)
    return resume


@router.delete("/resumes/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_saved_resume(
    resume_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    resume = await db.get(Resume, resume_id)
    if resume is None or resume.user_id != user.id:
        raise HTTPException(404, "Resume not found")
    if resume.s3_key:
        await run_in_threadpool(delete_object, resume.s3_key)
    await run_in_threadpool(delete_resume, resume.id)  # remove Chroma chunks
    await db.delete(resume)
    await db.commit()


# ---------------- Bring-your-own API key ----------------


class ApiKeyIn(BaseModel):
    api_key: str
    provider: str = "openrouter"


@router.put("/api-key", status_code=status.HTTP_204_NO_CONTENT)
async def set_api_key(
    payload: ApiKeyIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    if payload.provider.lower() not in _VALID_PROVIDERS:
        raise HTTPException(400, f"provider must be one of {sorted(_VALID_PROVIDERS)}")
    row = await db.get(User, user.id)
    row.encrypted_api_key = encrypt(payload.api_key)
    row.api_provider = payload.provider.lower()
    await db.commit()


@router.delete("/api-key", status_code=status.HTTP_204_NO_CONTENT)
async def clear_api_key(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    row = await db.get(User, user.id)
    row.encrypted_api_key = None
    row.api_provider = None
    await db.commit()


# ---------------- Usage counters ----------------


class UsageOut(BaseModel):
    today: int
    total: int
    daily_limit: int
    unlimited: bool
    has_api_key: bool


@router.get("/usage", response_model=UsageOut)
async def usage(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    day_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    # Failed analyses don't count as usage (they never produced a result).
    today = (
        await db.execute(
            select(func.count())
            .select_from(Analysis)
            .where(
                Analysis.user_id == user.id,
                Analysis.created_at >= day_start,
                Analysis.status != AnalysisStatus.failed,
            )
        )
    ).scalar_one()
    total = (
        await db.execute(
            select(func.count())
            .select_from(Analysis)
            .where(Analysis.user_id == user.id, Analysis.status != AnalysisStatus.failed)
        )
    ).scalar_one()
    has_key = bool(user.encrypted_api_key)
    return UsageOut(
        today=today,
        total=total,
        daily_limit=settings.daily_free_limit,
        unlimited=has_key,
        has_api_key=has_key,
    )


# ---------------- Usage tracker (history) ----------------


class TrackerItem(BaseModel):
    id: int
    created_at: datetime
    status: str
    match_score: int | None
    resume_label: str | None
    resume_summary: str | None
    job_summary: str | None
    applied: bool
    decision: str | None


@router.get("/analyses", response_model=list[TrackerItem])
async def my_analyses(
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(Analysis)
            .where(Analysis.user_id == user.id)
            .order_by(Analysis.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    items = []
    for a in rows:
        resume = await db.get(Resume, a.resume_id) if a.resume_id else None
        items.append(
            TrackerItem(
                id=a.id,
                created_at=a.created_at,
                status=a.status.value,
                match_score=a.match_score,
                resume_label=resume.label if resume else None,
                resume_summary=a.resume_summary,
                job_summary=a.job_summary,
                applied=a.applied,
                decision=a.decision.value if a.decision else None,
            )
        )
    return items


class TrackingUpdate(BaseModel):
    applied: bool | None = None
    decision: DecisionStatus | None = None


@router.patch("/analyses/{analysis_id}", status_code=status.HTTP_204_NO_CONTENT)
async def update_tracking(
    analysis_id: int,
    payload: TrackingUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    a = await db.get(Analysis, analysis_id)
    if a is None or a.user_id != user.id:
        raise HTTPException(404, "Analysis not found")
    if payload.applied is not None:
        a.applied = payload.applied
    if payload.decision is not None:
        a.decision = payload.decision
    await db.commit()


@router.delete("/analyses/{analysis_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_analysis(
    analysis_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    a = await db.get(Analysis, analysis_id)
    if a is None or a.user_id != user.id:
        raise HTTPException(404, "Analysis not found")
    await db.delete(a)
    await db.commit()


# ---------------- Resume editor document (one per user) ----------------


async def _get_resume_doc(db: AsyncSession, user_id: int) -> ResumeDocument | None:
    return (
        await db.execute(select(ResumeDocument).where(ResumeDocument.user_id == user_id))
    ).scalar_one_or_none()


@router.get("/resume-doc")
async def get_resume_doc(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Return the user's saved resume document (or null if they have none yet)."""
    row = await _get_resume_doc(db, user.id)
    return {
        "data": row.data if row else None,
        "updated_at": row.updated_at if row else None,
    }


@router.put("/resume-doc", status_code=status.HTTP_204_NO_CONTENT)
async def put_resume_doc(
    data: dict = Body(..., description="The full resume document as a JSON object"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upsert the user's resume document (the editor auto-saves the whole blob)."""
    row = await _get_resume_doc(db, user.id)
    if row is None:
        db.add(ResumeDocument(user_id=user.id, data=data))
    else:
        row.data = data
    await db.commit()
