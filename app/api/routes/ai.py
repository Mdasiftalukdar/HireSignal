"""AI endpoints (Phases 4-9). All require authentication.

- Phase 4: /parse-job                     synchronous structured extraction
- Phase 5: /resumes/index, /match         synchronous RAG
- Phase 6: /analyze, /analyze/{id}        async: store file -> queue -> background index+match
- Phase 9: /analyze now publishes to Kafka; a separate consumer service does the work.

Text-in endpoints take form fields so multi-line job descriptions paste cleanly.
"""

from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.analysis import Analysis, AnalysisStatus
from app.models.resume import Resume
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


async def _read_resume(file: UploadFile) -> tuple[bytes, str]:
    """Validate the upload type, read the bytes, and extract the text."""
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
    return data, text


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
    file: UploadFile = File(...), db: AsyncSession = Depends(get_db)
):
    _data, text = await _read_resume(file)
    resume = Resume(filename=file.filename, content_text=text)
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


# ---------- Phase 6/9: async analyze (store file -> Kafka -> consumer index+match) ----------


@router.post(
    "/analyze",
    response_model=AnalysisSubmitResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def analyze(
    file: UploadFile = File(...),
    job_description: str = Form(..., min_length=20),
    db: AsyncSession = Depends(get_db),
):
    data, text = await _read_resume(file)

    # 1) Persist the ORIGINAL file in object storage (MinIO / S3).
    key = f"resumes/{uuid4().hex}-{file.filename}"
    await run_in_threadpool(
        upload_bytes, key, data, file.content_type or "application/octet-stream"
    )

    # 2) Record the resume (with its storage key) and a pending analysis.
    resume = Resume(filename=file.filename, content_text=text, s3_key=key)
    db.add(resume)
    await db.commit()
    await db.refresh(resume)

    analysis = Analysis(
        resume_id=resume.id, job_description=job_description, status=AnalysisStatus.pending
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    # 3) Publish the job to Kafka; the consumer service does the heavy work.
    try:
        await publish_analysis(analysis.id)
    except Exception as exc:  # noqa: BLE001 - queue unavailable
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Analysis queue is unavailable; please retry shortly.",
        ) from exc

    return AnalysisSubmitResponse(
        analysis_id=analysis.id, resume_id=resume.id, status=analysis.status, s3_key=key
    )


@router.get("/analyze/{analysis_id}", response_model=AnalysisRead)
async def get_analysis(analysis_id: int, db: AsyncSession = Depends(get_db)):
    analysis = await db.get(Analysis, analysis_id)
    if analysis is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return analysis
