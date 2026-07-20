"""CRUD endpoints for Resumes (same pattern as jobs)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.resume import Resume
from app.schemas.resume import ResumeCreate, ResumeRead, ResumeUpdate

router = APIRouter(
    prefix="/resumes", tags=["resumes"], dependencies=[Depends(get_current_user)]
)


@router.post("", response_model=ResumeRead, status_code=status.HTTP_201_CREATED)
async def create_resume(payload: ResumeCreate, db: AsyncSession = Depends(get_db)):
    resume = Resume(**payload.model_dump())
    db.add(resume)
    await db.commit()
    await db.refresh(resume)
    return resume


@router.get("", response_model=list[ResumeRead])
async def list_resumes(
    skip: int = 0, limit: int = 20, db: AsyncSession = Depends(get_db)
):
    stmt = select(Resume).order_by(Resume.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{resume_id}", response_model=ResumeRead)
async def get_resume(resume_id: int, db: AsyncSession = Depends(get_db)):
    resume = await db.get(Resume, resume_id)
    if resume is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")
    return resume


@router.patch("/{resume_id}", response_model=ResumeRead)
async def update_resume(
    resume_id: int, payload: ResumeUpdate, db: AsyncSession = Depends(get_db)
):
    resume = await db.get(Resume, resume_id)
    if resume is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(resume, field, value)
    await db.commit()
    await db.refresh(resume)
    return resume


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resume(resume_id: int, db: AsyncSession = Depends(get_db)):
    resume = await db.get(Resume, resume_id)
    if resume is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")
    await db.delete(resume)
    await db.commit()
