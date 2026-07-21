"""Background analysis pipeline (Phase 6).

Runs off the request cycle via FastAPI BackgroundTasks. It opens its OWN DB session (the
request's session is already closed by the time this runs), indexes the resume, runs the
RAG match, and writes the result + status back to the `analyses` row. Any failure is
recorded on the row instead of crashing the worker.
"""

from fastapi.concurrency import run_in_threadpool

from app.db.session import AsyncSessionLocal
from app.models.analysis import Analysis, AnalysisStatus
from app.models.resume import Resume
from app.services.rag import index_resume, match_resume_to_job


async def process_analysis(analysis_id: int) -> None:
    async with AsyncSessionLocal() as db:
        analysis = await db.get(Analysis, analysis_id)
        if analysis is None:
            return

        analysis.status = AnalysisStatus.processing
        await db.commit()

        try:
            resume = await db.get(Resume, analysis.resume_id)
            # Embedding is CPU-bound -> off the event loop.
            await run_in_threadpool(index_resume, resume.id, resume.content_text or "")
            report = await match_resume_to_job(resume.id, analysis.job_description)

            analysis.match_score = report.match_score
            analysis.matched_skills = report.matched_skills
            analysis.missing_skills = report.missing_skills
            analysis.recommendation = report.recommendation
            analysis.status = AnalysisStatus.completed
            analysis.error = None
        except Exception as exc:  # noqa: BLE001 - record failure, keep the worker alive
            analysis.status = AnalysisStatus.failed
            analysis.error = f"{exc.__class__.__name__}: {exc}"

        await db.commit()
