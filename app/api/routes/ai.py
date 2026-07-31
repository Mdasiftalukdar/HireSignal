"""AI endpoints (Phases 4-9 + Round 1). All require authentication.

- /parse-job            synchronous structured extraction
- /resumes/index, /match  synchronous RAG
- /analyze, /analyze/{id}  async: resume (saved | upload | paste) + JD -> Kafka -> consumer

Text-in endpoints take form fields so multi-line job descriptions paste cleanly.
"""

import asyncio
import json
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import AsyncSessionLocal, get_db
from app.models.analysis import Analysis, AnalysisStatus
from app.models.resume import Resume
from app.models.user import User
from app.schemas.analysis import AnalysisRead, AnalysisSubmitResponse
from app.services.events import publish_analysis
from app.services.extract import SUPPORTED, extract_text
from app.services.job_parser import ParsedJob, parse_job_description
from app.services.rag import MatchReport, index_resume, match_resume_to_job
from app.services.storage import upload_bytes

router = APIRouter(prefix="/ai", tags=["ai"], dependencies=[Depends(get_current_user)])


def _llm_http_error(exc: Exception) -> HTTPException:
    name = exc.__class__.__name__
    if name in {"ResourceExhausted", "TooManyRequests"}:
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="LLM rate limit reached. Please retry shortly.",
        )
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY, detail=f"LLM request failed: {name}"
    )


async def _read_upload(file: UploadFile) -> str:
    """Validate the upload type and return its extracted text."""
    if not (file.filename or "").lower().endswith(SUPPORTED):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Use one of: {', '.join(SUPPORTED)}",
        )
    data = await file.read()
    try:
        text = extract_text(file.filename, data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not text:
        raise HTTPException(status_code=400, detail="Could not extract text from the file")
    return text


# ---------- Phase 4: job-description parser ----------


@router.post("/parse-job", response_model=ParsedJob)
async def parse_job(job_description: str = Form(..., min_length=20)):
    try:
        return await parse_job_description(job_description)
    except Exception as exc:  # noqa: BLE001
        raise _llm_http_error(exc) from exc


# ---------- Phase 5: synchronous RAG ----------


class IndexResumeResponse(BaseModel):
    resume_id: int
    filename: str
    chunks_indexed: int


@router.post(
    "/resumes/index",
    response_model=IndexResumeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def index_resume_endpoint(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    text = await _read_upload(file)
    resume = Resume(user_id=user.id, filename=file.filename, content_text=text)
    db.add(resume)
    await db.commit()
    await db.refresh(resume)
    chunks = await run_in_threadpool(index_resume, resume.id, text)
    return IndexResumeResponse(
        resume_id=resume.id, filename=resume.filename, chunks_indexed=chunks
    )


@router.post("/match", response_model=MatchReport)
async def match_endpoint(
    resume_id: int = Form(...),
    job_description: str = Form(..., min_length=20),
    db: AsyncSession = Depends(get_db),
):
    if await db.get(Resume, resume_id) is None:
        raise HTTPException(status_code=404, detail="Resume not found")
    try:
        return await match_resume_to_job(resume_id, job_description)
    except Exception as exc:  # noqa: BLE001
        raise _llm_http_error(exc) from exc


# ---------- Round 1: async analyze (saved | upload | paste; daily limit; Kafka) ----------


@router.post(
    "/analyze",
    response_model=AnalysisSubmitResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def analyze(
    saved_resume_id: int | None = Form(None),
    resume_file: UploadFile | None = File(None),
    resume_text: str | None = Form(None),
    job_file: UploadFile | None = File(None),
    job_text: str | None = Form(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 1) Enforce the daily free limit unless the user brought their own API key.
    if not user.encrypted_api_key:
        day_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        used = (
            await db.execute(
                select(func.count())
                .select_from(Analysis)
                .where(Analysis.user_id == user.id, Analysis.created_at >= day_start)
            )
        ).scalar_one()
        if used >= settings.daily_free_limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"Daily free limit of {settings.daily_free_limit} reached. Add your own "
                    "API key in settings for unlimited checks."
                ),
            )

    # 2) Resolve the resume: a saved one, an on-the-fly upload, or pasted text.
    if saved_resume_id is not None:
        resume = await db.get(Resume, saved_resume_id)
        if resume is None or resume.user_id != user.id:
            raise HTTPException(status_code=404, detail="Saved resume not found")
    elif resume_file is not None and resume_file.filename:
        text = await _read_upload(resume_file)
        resume = Resume(user_id=user.id, filename=resume_file.filename, content_text=text)
        db.add(resume)
        await db.commit()
        await db.refresh(resume)
    elif resume_text:
        resume = Resume(user_id=user.id, filename="pasted.txt", content_text=resume_text.strip())
        db.add(resume)
        await db.commit()
        await db.refresh(resume)
    else:
        raise HTTPException(
            status_code=400,
            detail="Provide a resume (saved_resume_id, resume_file, or resume_text).",
        )

    # 3) Resolve the job description: an upload or pasted text.
    if job_file is not None and job_file.filename:
        jd = await _read_upload(job_file)
    elif job_text:
        jd = job_text.strip()
    else:
        raise HTTPException(status_code=400, detail="Provide a job description (job_file or job_text).")
    if len(jd) < 20:
        raise HTTPException(status_code=400, detail="Job description is too short.")

    # 4) Create the analysis and publish it to Kafka; the consumer does the heavy work.
    analysis = Analysis(
        user_id=user.id, resume_id=resume.id, job_description=jd, status=AnalysisStatus.pending
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    try:
        await publish_analysis(analysis.id)
    except Exception as exc:  # noqa: BLE001 - queue unavailable
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Analysis queue is unavailable; please retry shortly.",
        ) from exc

    return AnalysisSubmitResponse(
        analysis_id=analysis.id,
        resume_id=resume.id,
        status=analysis.status,
        s3_key=resume.s3_key or "",
    )


@router.get("/analyze/{analysis_id}", response_model=AnalysisRead)
async def get_analysis(
    analysis_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    analysis = await db.get(Analysis, analysis_id)
    if analysis is None or (analysis.user_id is not None and analysis.user_id != user.id):
        raise HTTPException(status_code=404, detail="Analysis not found")
    return analysis


@router.get("/analyze/{analysis_id}/stream")
async def stream_analysis(
    analysis_id: int, user: User = Depends(get_current_user)
):
    """Server-Sent Events stream of an analysis until it completes or fails.

    Moves the poll loop to the server: the client opens ONE streaming connection
    and we push a status event whenever the row changes (the Kafka consumer writes
    the result), plus periodic heartbeats. Each poll uses its own short-lived
    session because the generator runs after the request handler returns.
    """

    async def event_gen():
        loop = asyncio.get_event_loop()
        deadline = loop.time() + 120  # give up after 2 minutes
        last_serialized: str | None = None

        while True:
            async with AsyncSessionLocal() as db:
                analysis = await db.get(Analysis, analysis_id)
                if analysis is None or (
                    analysis.user_id is not None and analysis.user_id != user.id
                ):
                    yield f"event: error\ndata: {json.dumps({'detail': 'Analysis not found'})}\n\n"
                    return
                payload = AnalysisRead.model_validate(analysis).model_dump(mode="json")
                terminal = analysis.status in (AnalysisStatus.completed, AnalysisStatus.failed)

            serialized = json.dumps(payload, default=str)
            # Only emit when something changed (avoids spamming identical frames).
            if serialized != last_serialized:
                yield f"data: {serialized}\n\n"
                last_serialized = serialized

            if terminal:
                return
            if loop.time() > deadline:
                yield f"event: timeout\ndata: {json.dumps({'detail': 'Timed out'})}\n\n"
                return

            yield ": keep-alive\n\n"  # comment frame keeps the connection warm
            await asyncio.sleep(1.5)

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # don't let a proxy buffer the stream
        },
    )
