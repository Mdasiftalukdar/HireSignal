"""Extract structured data from a free-text job posting using an LLM.

The model is constrained to a Pydantic schema (`ParsedJob`) via LangChain's
`with_structured_output`, so we get typed, validated fields back instead of loose prose.
Temperature 0 (set in the model factory) keeps extraction deterministic.
"""

from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field

from app.services.llm import get_chat_model


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


async def parse_job_description(text: str) -> ParsedJob:
    # `with_structured_output` forces the model to return data matching ParsedJob.
    chain = _PROMPT | get_chat_model().with_structured_output(ParsedJob)
    return await chain.ainvoke({"job_description": text})
