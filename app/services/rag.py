"""RAG pipeline: index a resume, then match it against a job description.

Index:  resume text -> chunks -> embeddings -> ChromaDB.
Match:  embed the job description -> retrieve the top-k most similar resume chunks ->
        feed ONLY those chunks to the LLM -> structured MatchReport.

Retrieval + embedding are CPU-bound and synchronous, so callers run them off the event
loop (see the endpoint / `match_resume_to_job`). The LLM call reuses the same resilient
provider chain (with fallbacks) as the Phase 4 parser.
"""

from fastapi.concurrency import run_in_threadpool
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import Runnable
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.embeddings import embed_query, embed_texts
from app.services.chunking import chunk_text
from app.services.llm import get_chat_model, provider_order
from app.services.vectorstore import query_resume, upsert_chunks


class MatchReport(BaseModel):
    match_score: int = Field(ge=0, le=100, description="Overall fit, 0-100")
    matched_skills: list[str] = Field(
        default_factory=list,
        description="Skills the job wants that the resume clearly demonstrates",
    )
    missing_skills: list[str] = Field(
        default_factory=list,
        description="Skills the job wants that the resume does not show",
    )
    keyword_matches: list[str] = Field(
        default_factory=list,
        description="Important keywords/terms from the job description present in the resume",
    )
    keyword_gaps: list[str] = Field(
        default_factory=list,
        description="Important keywords/terms from the job description missing from the resume",
    )
    section_suggestions: list[str] = Field(
        default_factory=list,
        description="Concrete section-by-section improvements, e.g. 'Summary: ...', 'Experience: ...'",
    )
    weaknesses: list[str] = Field(
        default_factory=list,
        description="Where the resume is weak or thin for THIS specific role",
    )
    suggested_bullets: list[str] = Field(
        default_factory=list,
        description=(
            "3-5 ready-to-paste resume bullet points weaving in the target/missing skills, "
            "phrased for once the candidate has gained them"
        ),
    )
    resume_summary: str = Field(
        default="", description="1-2 sentence summary of the candidate's resume"
    )
    job_summary: str = Field(
        default="", description="1-2 sentence summary of the job (role + key requirements)"
    )
    recommendation: str = Field(
        description="2-3 sentence overall recommendation to the candidate"
    )


def index_resume(resume_id: int, text: str) -> int:
    """Chunk + embed + store a resume. Returns the number of chunks indexed. (sync)"""
    chunks = chunk_text(text)
    if not chunks:
        return 0
    upsert_chunks(resume_id, chunks, embed_texts(chunks))
    return len(chunks)


_MATCH_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are an expert technical recruiter and ATS-savvy resume coach. Assess how well a "
            "candidate fits a role using ONLY the provided resume excerpts - never invent experience. "
            "Make ALL feedback ATS-friendly: reuse the job description's exact keywords/terminology, "
            "standard section names, and strong action verbs with quantified impact in bullets. "
            "Provide matched vs missing skills, keyword coverage, section-by-section improvements, "
            "weaknesses for THIS role, 3-5 concrete resume bullets the candidate could add once they "
            "gain the missing skills, and a 1-2 sentence summary of both the resume and the job.",
        ),
        (
            "human",
            "JOB DESCRIPTION:\n{job}\n\nRELEVANT RESUME EXCERPTS:\n{context}\n\n"
            "Produce the structured match report.",
        ),
    ]
)


def _match_chain(api_key: str | None = None, provider: str | None = None) -> Runnable:
    # Bring-your-own key: use ONLY the user's provider/key (never fall back to our keys).
    if api_key and provider:
        return _MATCH_PROMPT | get_chat_model(
            provider, api_key=api_key
        ).with_structured_output(MatchReport)

    providers = provider_order()
    if not providers:
        raise RuntimeError("No LLM provider is configured with an API key.")
    chains = [
        _MATCH_PROMPT | get_chat_model(p).with_structured_output(MatchReport)
        for p in providers
    ]
    primary, *fallbacks = chains
    return primary.with_fallbacks(fallbacks) if fallbacks else primary


def _retrieve(resume_id: int, job_description: str) -> list[str]:
    return query_resume(resume_id, embed_query(job_description), settings.retrieve_top_k)


async def match_resume_to_job(
    resume_id: int,
    job_description: str,
    api_key: str | None = None,
    provider: str | None = None,
) -> MatchReport:
    chunks = await run_in_threadpool(_retrieve, resume_id, job_description)
    context = "\n---\n".join(chunks) if chunks else "(no resume content indexed)"
    return await _match_chain(api_key, provider).ainvoke(
        {"job": job_description, "context": context}
    )
