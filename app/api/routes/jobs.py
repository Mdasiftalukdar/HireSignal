"""CRUD endpoints for Jobs, with Redis cache-aside on the read endpoints.

Reads try Redis first (cache HIT) and fall back to Postgres (cache MISS), storing the
result with a TTL. Writes invalidate the cached reads so clients never see stale data.
An `X-Cache: HIT|MISS` response header makes the behavior observable.
"""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.cache import cache_get_json, cache_invalidate_prefix, cache_set_json
from app.db.session import get_db
from app.models.job import Job
from app.schemas.job import JobCreate, JobRead, JobUpdate

# Router-level dependency: every jobs endpoint requires a valid JWT.
router = APIRouter(
    prefix="/jobs", tags=["jobs"], dependencies=[Depends(get_current_user)]
)

CACHE_PREFIX = "jobs:"


@router.post("", response_model=JobRead, status_code=status.HTTP_201_CREATED)
async def create_job(payload: JobCreate, db: AsyncSession = Depends(get_db)):
    job = Job(**payload.model_dump())
    db.add(job)
    await db.commit()
    await db.refresh(job)
    await cache_invalidate_prefix(CACHE_PREFIX)  # a new row makes cached lists stale
    return job


@router.get("", response_model=list[JobRead])
async def list_jobs(
    response: Response,
    skip: int = 0,
    limit: int = 20,
    active_only: bool = False,
    db: AsyncSession = Depends(get_db),
):
    key = f"{CACHE_PREFIX}list:{skip}:{limit}:{active_only}"
    cached = await cache_get_json(key)
    if cached is not None:
        response.headers["X-Cache"] = "HIT"
        return cached

    stmt = select(Job).order_by(Job.created_at.desc()).offset(skip).limit(limit)
    if active_only:
        stmt = stmt.where(Job.is_active.is_(True))
    result = await db.execute(stmt)
    data = [JobRead.model_validate(j).model_dump(mode="json") for j in result.scalars()]

    await cache_set_json(key, data)
    response.headers["X-Cache"] = "MISS"
    return data


@router.get("/{job_id}", response_model=JobRead)
async def get_job(job_id: int, response: Response, db: AsyncSession = Depends(get_db)):
    key = f"{CACHE_PREFIX}detail:{job_id}"
    cached = await cache_get_json(key)
    if cached is not None:
        response.headers["X-Cache"] = "HIT"
        return cached

    job = await db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    data = JobRead.model_validate(job).model_dump(mode="json")

    await cache_set_json(key, data)
    response.headers["X-Cache"] = "MISS"
    return data


@router.patch("/{job_id}", response_model=JobRead)
async def update_job(
    job_id: int, payload: JobUpdate, db: AsyncSession = Depends(get_db)
):
    job = await db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(job, field, value)
    await db.commit()
    await db.refresh(job)
    await cache_invalidate_prefix(CACHE_PREFIX)
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(job_id: int, db: AsyncSession = Depends(get_db)):
    job = await db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    await db.delete(job)
    await db.commit()
    await cache_invalidate_prefix(CACHE_PREFIX)
