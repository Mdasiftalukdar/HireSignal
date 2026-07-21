"""Extract structured data from a free-text job posting using an LLM.

The model is constrained to a Pydantic schema (`ParsedJob`) via LangChain's
`with_structured_output`, so we get typed, validated fields back instead of loose prose.

The chain uses `.with_fallbacks(...)`: it tries the primary provider first and, if that
call raises (e.g. Gemini hits its free-tier quota), automatically retries the same request
on the next configured provider (DeepSeek) - no client-visible failure.
"""

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import Runnable
from pydantic import BaseModel, Field

from app.services.llm import get_chat_model, provider_order


class ParsedJob(BaseModel):
    """Structured fields extracted from a job description."""

    title: str = Field(description="The job title / role name")
    company: str | None = Field(default=None, description="Hiring company, if stated")
    location: str | None = Field(
        default=None, description="Location or 'Remote', if stated"
    )
    seniority: str | None = Field(
        default=None, description="e.g. Intern, Junior, Mid, Senior, Staff, Lead"
    )
    required_skills: list[str] = Field(
        default_factory=list,
        description="Concrete skills / technologies the role requires",
    )
    salary_min: int | None = Field(default=None, description="Lower salary bound, if stated")
    salary_max: int | None = Field(default=None, description="Upper salary bound, if stated")
    summary: str | None = Field(default=None, description="One-sentence summary of the role")


_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You extract structured data from job postings. Use ONLY information present "
            "in the text. If a field is not stated, leave it null or an empty list - never guess.",
        ),
        ("human", "Extract the structured job data from this posting:\n\n{job_description}"),
    ]
)


def _build_chain() -> Runnable:
    """Primary provider chain with automatic fallback to the remaining providers."""
    providers = provider_order()
    if not providers:
        raise RuntimeError("No LLM provider is configured with an API key.")
    chains = [
        _PROMPT | get_chat_model(p).with_structured_output(ParsedJob) for p in providers
    ]
    primary, *fallbacks = chains
    return primary.with_fallbacks(fallbacks) if fallbacks else primary


async def parse_job_description(text: str) -> ParsedJob:
    return await _build_chain().ainvoke({"job_description": text})
