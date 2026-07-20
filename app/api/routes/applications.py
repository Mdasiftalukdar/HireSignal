"""CRUD endpoints for Applications.

New idea here: we validate the referenced job_id and resume_id *before* inserting, so
a bad reference returns a clean 400 instead of a raw database IntegrityError (500).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.application import Application
from app.models.job import Job
from app.models.resume import Resume
from app.schemas.application import (
    ApplicationCreate,
    ApplicationRead,
    ApplicationUpdate,
)

router = APIRouter(prefix="/applications", tags=["applications"])


async def _ensure_exists(db: AsyncSession, model, pk: int, label: str) -> None:
    if await db.get(model, pk) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{label} {pk} does not exist",
        )


@router.post("", response_model=ApplicationRead, status_code=status.HTTP_201_CREATED)
async def create_application(
    payload: ApplicationCreate, db: AsyncSession = Depends(get_db)
):
    await _ensure_exists(db, Job, payload.job_id, "job_id")
    await _ensure_exists(db, Resume, payload.resume_id, "resume_id")
    application = Application(**payload.model_dump())
    db.add(application)
    await db.commit()
    await db.refresh(application)
    return application


@router.get("", response_model=list[ApplicationRead])
async def list_applications(
    skip: int = 0, limit: int = 20, db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Application)
        .order_by(Application.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{application_id}", response_model=ApplicationRead)
async def get_application(application_id: int, db: AsyncSession = Depends(get_db)):
    application = await db.get(Application, application_id)
    if application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Application not found"
        )
    return application


@router.patch("/{application_id}", response_model=ApplicationRead)
async def update_application(
    application_id: int, payload: ApplicationUpdate, db: AsyncSession = Depends(get_db)
):
    application = await db.get(Application, application_id)
    if application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Application not found"
        )
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(application, field, value)
    await db.commit()
    await db.refresh(application)
    return application


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_application(application_id: int, db: AsyncSession = Depends(get_db)):
    application = await db.get(Application, application_id)
    if application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Application not found"
        )
    await db.delete(application)
    await db.commit()
