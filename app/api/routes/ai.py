"""AI endpoints (Phase 4-5). Requires authentication like the other resources."""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.resume import Resume
from app.services.job_parser import ParsedJob, parse_job_description
from app.services.pdf import extract_text_from_pdf
from app.services.rag import MatchReport, index_resume, match_resume_to_job

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


# ---------- Phase 4: job-description parser ----------


class ParseJobRequest(BaseModel):
    job_description: str = Field(min_length=20)


@router.post("/parse-job", response_model=ParsedJob)
async def parse_job(payload: ParseJobRequest):
    try:
        return await parse_job_description(payload.job_description)
    except Exception as exc:  # noqa: BLE001
        raise _llm_http_error(exc) from exc


# ---------- Phase 5: RAG (index a resume, match it to a job) ----------


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
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload a PDF file")
    text = extract_text_from_pdf(await file.read())
    if not text:
        raise HTTPException(status_code=400, detail="Could not extract text from the PDF")

    resume = Resume(filename=file.filename, content_text=text)
    db.add(resume)
    await db.commit()
    await db.refresh(resume)

    # Embedding is CPU-bound -> keep it off the event loop.
    chunks = await run_in_threadpool(index_resume, resume.id, text)
    return IndexResumeResponse(
        resume_id=resume.id, filename=resume.filename, chunks_indexed=chunks
    )


class MatchRequest(BaseModel):
    resume_id: int
    job_description: str = Field(min_length=20)


@router.post("/match", response_model=MatchReport)
async def match_endpoint(payload: MatchRequest, db: AsyncSession = Depends(get_db)):
    if await db.get(Resume, payload.resume_id) is None:
        raise HTTPException(status_code=404, detail="Resume not found")
    try:
        return await match_resume_to_job(payload.resume_id, payload.job_description)
    except Exception as exc:  # noqa: BLE001
        raise _llm_http_error(exc) from exc
