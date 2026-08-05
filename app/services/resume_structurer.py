"""Turn raw resume text into a structured document the editor can load.

Uses the same LangChain structured-output + provider-fallback pattern as the job
parser. It ONLY reorganizes the candidate's real text into sections/entries/bullets;
the prompt forbids inventing any experience, skills, employers, or dates.
"""

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import Runnable
from pydantic import BaseModel, Field

from app.services.llm import get_chat_model, provider_order


class StructEntry(BaseModel):
    title: str = Field(default="", description="Role title or degree")
    subtitle: str = Field(default="", description="Company or school")
    meta: str = Field(default="", description="Dates and/or location, e.g. '2022 - 2024 - Toronto'")
    bullets: list[str] = Field(default_factory=list, description="Achievements/responsibilities")


class StructSection(BaseModel):
    heading: str = Field(default="", description="Section name, e.g. Experience, Education, Skills")
    entries: list[StructEntry] = Field(default_factory=list)


class StructuredResume(BaseModel):
    full_name: str = Field(default="", description="Candidate full name")
    headline: str = Field(default="", description="Professional headline/title, if present")
    email: str = Field(default="")
    phone: str = Field(default="")
    location: str = Field(default="")
    website: str = Field(default="", description="Portfolio/LinkedIn/GitHub URL, if present")
    summary: str = Field(default="", description="Professional summary paragraph, if present")
    sections: list[StructSection] = Field(default_factory=list)


_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You convert raw resume text into structured JSON for a resume editor. "
            "Preserve the candidate's REAL content - keep their wording where you can. "
            "NEVER invent experience, skills, employers, dates, or contact details that are not "
            "in the text. Pull the name and contact info into the header fields. Put any summary/"
            "objective paragraph in `summary`. Group the rest into standard sections such as "
            "Experience, Education, Skills, Projects, Certifications. For each entry set `title` "
            "(role or degree), `subtitle` (company or school), `meta` (dates and/or location), and "
            "`bullets`. For a Skills section, use one entry whose bullets are the skill groups. "
            "If a field is absent, leave it empty.",
        ),
        ("human", "RESUME TEXT:\n{resume}\n\nProduce the structured resume."),
    ]
)


def _chain(api_key: str | None = None, provider: str | None = None) -> Runnable:
    if api_key and provider:
        return _PROMPT | get_chat_model(provider, api_key=api_key).with_structured_output(
            StructuredResume
        )
    providers = provider_order()
    if not providers:
        raise RuntimeError("No LLM provider is configured with an API key.")
    chains = [
        _PROMPT | get_chat_model(p).with_structured_output(StructuredResume) for p in providers
    ]
    primary, *fallbacks = chains
    return primary.with_fallbacks(fallbacks) if fallbacks else primary


async def structure_resume(
    text: str, api_key: str | None = None, provider: str | None = None
) -> StructuredResume:
    return await _chain(api_key, provider).ainvoke({"resume": text})
