"""Background analysis pipeline: index the resume, run the RAG match, persist the result.

Runs in the Kafka consumer (its own process/session). If the analysis's owner set a
bring-your-own LLM key, it is decrypted and used for their request; otherwise the server's
provider chain is used. Failures are recorded on the row, never crashing the worker.
"""

import logging
import time

from fastapi.concurrency import run_in_threadpool

from app.core.crypto import decrypt
from app.core.metrics import ai_processing_seconds
from app.db.session import AsyncSessionLocal
from app.models.analysis import Analysis, AnalysisStatus
from app.models.resume import Resume
from app.models.user import User
from app.core.config import settings
from app.services.agent import analyze_resume_agent
from app.services.rag import index_resume, match_resume_to_job

log = logging.getLogger("hiresignal.analysis")


async def process_analysis(analysis_id: int) -> None:
    async with AsyncSessionLocal() as db:
        analysis = await db.get(Analysis, analysis_id)
        if analysis is None:
            return

        analysis.status = AnalysisStatus.processing
        await db.commit()

        start = time.perf_counter()
        try:
            resume = await db.get(Resume, analysis.resume_id)

            # Bring-your-own key (decrypted) if the owner set one.
            api_key = provider = None
            if analysis.user_id is not None:
                user = await db.get(User, analysis.user_id)
                if user and user.encrypted_api_key:
                    api_key = decrypt(user.encrypted_api_key)
                    provider = user.api_provider

            await run_in_threadpool(index_resume, resume.id, resume.content_text or "")

            # Cost control: the LangGraph agent makes several LLM calls (grade +
            # generate + critique, plus any loops); the plain LangChain chain makes
            # one. Gate the agent by policy so the free tier (our key) stays cheap.
            mode = settings.analyze_agent_mode.lower()
            use_agent = mode == "always" or (mode == "byok" and api_key is not None)

            if use_agent:
                report, steps = await analyze_resume_agent(
                    resume.id, analysis.job_description, api_key=api_key, provider=provider
                )
                log.info("analysis %s agent path: %s", analysis_id, " -> ".join(steps))
            else:
                report = await match_resume_to_job(
                    resume.id, analysis.job_description, api_key=api_key, provider=provider
                )
                log.info("analysis %s simple LangChain path (mode=%s)", analysis_id, mode)

            analysis.match_score = report.match_score
            analysis.matched_skills = report.matched_skills
            analysis.missing_skills = report.missing_skills
            analysis.recommendation = report.recommendation
            analysis.keyword_matches = report.keyword_matches
            analysis.keyword_gaps = report.keyword_gaps
            analysis.section_suggestions = report.section_suggestions
            analysis.weaknesses = report.weaknesses
            analysis.suggested_bullets = report.suggested_bullets
            analysis.resume_summary = report.resume_summary
            analysis.job_summary = report.job_summary
            analysis.status = AnalysisStatus.completed
            analysis.error = None
        except Exception as exc:  # noqa: BLE001 - record failure, keep the worker alive
            analysis.status = AnalysisStatus.failed
            analysis.error = f"{exc.__class__.__name__}: {exc}"
        finally:
            ai_processing_seconds.labels(operation="analyze").observe(
                time.perf_counter() - start
            )

        await db.commit()
