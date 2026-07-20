"""AI endpoints (Phase 4+). Requires authentication like the other resources."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.services.job_parser import ParsedJob, parse_job_description

router = APIRouter(prefix="/ai", tags=["ai"], dependencies=[Depends(get_current_user)])


class ParseJobRequest(BaseModel):
    job_description: str = Field(min_length=20)


@router.post("/parse-job", response_model=ParsedJob)
async def parse_job(payload: ParseJobRequest):
    try:
        return await parse_job_description(payload.job_description)
    except Exception as exc:  # noqa: BLE001 - surface provider/LLM failures cleanly
        name = exc.__class__.__name__
        if name in {"ResourceExhausted", "TooManyRequests"}:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="LLM rate limit reached (free tier). Please retry shortly.",
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM request failed: {name}",
        ) from exc
