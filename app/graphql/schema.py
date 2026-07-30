"""GraphQL API (Strawberry) mounted at /graphql, alongside the REST API.

Highlights:
- queries (jobs, job, applications) and mutations (create/update application)
- a **DataLoader** that solves the N+1 problem: fetching many applications and their nested
  job/resume batches the lookups into ONE query per type instead of one per row.

Note: the playground/endpoint is left open for demoing. In production you'd secure it (e.g.
read the JWT in `get_context` and reject unauthenticated GraphQL operations).
"""

from typing import Optional

import strawberry
from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader
from strawberry.fastapi import GraphQLRouter
from strawberry.types import Info

from app.db.session import get_db
from app.models.application import Application, ApplicationStatus
from app.models.job import Job
from app.models.resume import Resume


# ---------- GraphQL types ----------


@strawberry.type
class JobType:
    id: int
    title: str
    company: str
    location: Optional[str]
    seniority: Optional[str]
    salary_min: Optional[int]
    salary_max: Optional[int]
    source: Optional[str]
    is_active: bool


@strawberry.type
class ResumeType:
    id: int
    filename: str


@strawberry.type
class ApplicationType:
    id: int
    status: str
    match_score: Optional[int]
    notes: Optional[str]
    job_id: int
    resume_id: int

    @strawberry.field
    async def job(self, info: Info) -> Optional[JobType]:
        # Batched via DataLoader -> no N+1.
        return await info.context["job_loader"].load(self.job_id)

    @strawberry.field
    async def resume(self, info: Info) -> Optional[ResumeType]:
        return await info.context["resume_loader"].load(self.resume_id)


def _to_job(j: Optional[Job]) -> Optional[JobType]:
    if j is None:
        return None
    return JobType(
        id=j.id, title=j.title, company=j.company, location=j.location,
        seniority=j.seniority, salary_min=j.salary_min, salary_max=j.salary_max,
        source=j.source, is_active=j.is_active,
    )


def _to_resume(r: Optional[Resume]) -> Optional[ResumeType]:
    return ResumeType(id=r.id, filename=r.filename) if r is not None else None


def _to_application(a: Application) -> ApplicationType:
    return ApplicationType(
        id=a.id, status=a.status.value, match_score=a.match_score,
        notes=a.notes, job_id=a.job_id, resume_id=a.resume_id,
    )


# ---------- DataLoaders (batch + de-dupe lookups within one request) ----------


def make_job_loader(db: AsyncSession) -> DataLoader:
    async def batch(keys: list[int]) -> list[Optional[JobType]]:
        rows = (await db.execute(select(Job).where(Job.id.in_(keys)))).scalars().all()
        by_id = {j.id: j for j in rows}
        return [_to_job(by_id.get(k)) for k in keys]  # order aligned to keys

    return DataLoader(load_fn=batch)


def make_resume_loader(db: AsyncSession) -> DataLoader:
    async def batch(keys: list[int]) -> list[Optional[ResumeType]]:
        rows = (await db.execute(select(Resume).where(Resume.id.in_(keys)))).scalars().all()
        by_id = {r.id: r for r in rows}
        return [_to_resume(by_id.get(k)) for k in keys]

    return DataLoader(load_fn=batch)


# ---------- Query / Mutation ----------


@strawberry.type
class Query:
    @strawberry.field
    async def jobs(self, info: Info, limit: int = 20) -> list[JobType]:
        db = info.context["db"]
        rows = (
            await db.execute(select(Job).order_by(Job.created_at.desc()).limit(limit))
        ).scalars().all()
        return [_to_job(j) for j in rows]

    @strawberry.field
    async def job(self, info: Info, id: int) -> Optional[JobType]:
        return await info.context["job_loader"].load(id)

    @strawberry.field
    async def applications(
        self, info: Info, status: Optional[str] = None, limit: int = 20
    ) -> list[ApplicationType]:
        db = info.context["db"]
        stmt = select(Application).order_by(Application.created_at.desc()).limit(limit)
        if status is not None:
            stmt = stmt.where(Application.status == ApplicationStatus(status))
        rows = (await db.execute(stmt)).scalars().all()
        return [_to_application(a) for a in rows]


@strawberry.type
class Mutation:
    @strawberry.mutation
    async def create_application(
        self, info: Info, job_id: int, resume_id: int
    ) -> ApplicationType:
        db = info.context["db"]
        row = Application(job_id=job_id, resume_id=resume_id)
        db.add(row)
        await db.commit()
        await db.refresh(row)
        return _to_application(row)

    @strawberry.mutation
    async def update_application_status(
        self, info: Info, id: int, status: str
    ) -> Optional[ApplicationType]:
        db = info.context["db"]
        row = await db.get(Application, id)
        if row is None:
            return None
        row.status = ApplicationStatus(status)  # validates against the enum
        await db.commit()
        await db.refresh(row)
        return _to_application(row)


schema = strawberry.Schema(query=Query, mutation=Mutation)


async def get_context(db: AsyncSession = Depends(get_db)) -> dict:
    # One DB session + fresh DataLoaders per request.
    return {
        "db": db,
        "job_loader": make_job_loader(db),
        "resume_loader": make_resume_loader(db),
    }


graphql_router = GraphQLRouter(schema, context_getter=get_context)
