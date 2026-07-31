"""LangGraph agentic analysis (R4).

Layers a self-correcting agent ON TOP OF the existing LangChain RAG. The graph:

    retrieve -> grade relevance -> (re-retrieve with a refined query) ->
    generate MatchReport -> self-critique -> (regenerate with the critique) -> finalize

Only the async `/analyze` pipeline runs through this graph. The simple synchronous
paths (`/ai/match`, `/ai/parse-job`) keep using the plain LangChain chains, so BOTH
LangChain and LangGraph are showcased. Each node reuses the same provider-fallback
LLM factory, the same embeddings/vector store, and the same MatchReport schema.
"""

from typing import Optional, TypedDict

from fastapi.concurrency import run_in_threadpool
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import Runnable
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.embeddings import embed_query
from app.services.llm import get_chat_model, provider_order
from app.services.rag import MatchReport
from app.services.vectorstore import query_resume

MAX_RETRIEVALS = 2  # one re-retrieval at most
MAX_REVISIONS = 2   # one regeneration at most


# ---- Structured outputs for the reasoning steps ----


class _Relevance(BaseModel):
    sufficient: bool = Field(
        description="True if the excerpts are enough to fairly assess fit for the job"
    )
    refined_query: str = Field(
        default="",
        description="If insufficient, a better retrieval query (the job's key skills/terms)",
    )


class _Critique(BaseModel):
    acceptable: bool = Field(
        description="True if the report is grounded in the excerpts, ATS-friendly, and complete"
    )
    issues: str = Field(
        default="",
        description="If not acceptable, the concrete problems to fix (e.g. invented skills)",
    )


class AgentState(TypedDict, total=False):
    resume_id: int
    job_description: str
    api_key: Optional[str]
    provider: Optional[str]
    query: str
    chunks: list[str]
    retrievals: int
    revisions: int
    sufficient: bool
    acceptable: bool
    critique: str
    report: MatchReport
    steps: list[str]  # a human-readable trace of the path taken (observability)


# ---- Prompts ----

_GRADE_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You grade whether retrieved résumé excerpts are sufficient to assess a candidate's "
            "fit for a job. If they clearly lack the information needed (too sparse, off-topic), "
            "mark them insufficient and propose a better retrieval query built from the job's key "
            "skills and terminology.",
        ),
        ("human", "JOB DESCRIPTION:\n{job}\n\nRETRIEVED RESUME EXCERPTS:\n{context}"),
    ]
)

_GENERATE_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are an expert technical recruiter and ATS-savvy resume coach. Assess how well a "
            "candidate fits a role using ONLY the provided resume excerpts - never invent experience. "
            "Make ALL feedback ATS-friendly: reuse the job description's exact keywords/terminology, "
            "standard section names, and strong action verbs with quantified impact in bullets. "
            "Provide matched vs missing skills, keyword coverage, section-by-section improvements, "
            "weaknesses for THIS role, 3-5 concrete resume bullets the candidate could add once they "
            "gain the missing skills, and a 1-2 sentence summary of both the résumé and the job.\n"
            "REVISION NOTES from a reviewer (address them if present): {revision_notes}",
        ),
        (
            "human",
            "JOB DESCRIPTION:\n{job}\n\nRELEVANT RESUME EXCERPTS:\n{context}\n\n"
            "Produce the structured match report.",
        ),
    ]
)

_CRITIQUE_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are a strict reviewer of résumé match reports. Reject the report if it: claims "
            "skills NOT supported by the excerpts (hallucination); ignores obvious keywords from the "
            "job; gives vague, non-quantified bullets; or leaves required fields thin. Otherwise "
            "accept it. Be concise about any issues to fix.",
        ),
        (
            "human",
            "JOB DESCRIPTION:\n{job}\n\nRESUME EXCERPTS:\n{context}\n\nREPORT (JSON):\n{report}",
        ),
    ]
)


def _context(chunks: list[str]) -> str:
    return "\n---\n".join(chunks) if chunks else "(no resume content indexed)"


def _chain(prompt: ChatPromptTemplate, schema: type, state: AgentState) -> Runnable:
    """A structured-output chain honoring BYO key, else the provider-fallback chain."""
    api_key, provider = state.get("api_key"), state.get("provider")
    if api_key and provider:
        return prompt | get_chat_model(provider, api_key=api_key).with_structured_output(schema)

    providers = provider_order()
    if not providers:
        raise RuntimeError("No LLM provider is configured with an API key.")
    chains = [prompt | get_chat_model(p).with_structured_output(schema) for p in providers]
    primary, *fallbacks = chains
    return primary.with_fallbacks(fallbacks) if fallbacks else primary


# ---- Nodes ----


def _retrieve_sync(resume_id: int, query: str, k: int) -> list[str]:
    # Embedding + vector query are both CPU-bound and synchronous - run them together
    # in one threadpool hop so the event loop is never blocked.
    return query_resume(resume_id, embed_query(query), k)


async def _retrieve(state: AgentState) -> dict:
    query = state.get("query") or state["job_description"]
    chunks = await run_in_threadpool(
        _retrieve_sync, state["resume_id"], query, settings.retrieve_top_k
    )
    steps = state.get("steps", []) + [f"retrieve(n={len(chunks)})"]
    return {"chunks": chunks, "retrievals": state.get("retrievals", 0) + 1, "steps": steps}


async def _grade(state: AgentState) -> dict:
    grade: _Relevance = await _chain(_GRADE_PROMPT, _Relevance, state).ainvoke(
        {"job": state["job_description"], "context": _context(state.get("chunks", []))}
    )
    steps = state.get("steps", []) + [f"grade(sufficient={grade.sufficient})"]
    out: dict = {"sufficient": grade.sufficient, "steps": steps}
    if not grade.sufficient and grade.refined_query:
        out["query"] = grade.refined_query
    return out


async def _generate(state: AgentState) -> dict:
    report: MatchReport = await _chain(_GENERATE_PROMPT, MatchReport, state).ainvoke(
        {
            "job": state["job_description"],
            "context": _context(state.get("chunks", [])),
            "revision_notes": state.get("critique") or "(none - first draft)",
        }
    )
    revisions = state.get("revisions", 0) + 1
    steps = state.get("steps", []) + [f"generate(draft={revisions})"]
    return {"report": report, "revisions": revisions, "steps": steps}


async def _critique(state: AgentState) -> dict:
    crit: _Critique = await _chain(_CRITIQUE_PROMPT, _Critique, state).ainvoke(
        {
            "job": state["job_description"],
            "context": _context(state.get("chunks", [])),
            "report": state["report"].model_dump_json(),
        }
    )
    steps = state.get("steps", []) + [f"critique(acceptable={crit.acceptable})"]
    return {"acceptable": crit.acceptable, "critique": crit.issues, "steps": steps}


# ---- Conditional routing ----


def _route_after_grade(state: AgentState) -> str:
    if state.get("sufficient") or state.get("retrievals", 0) >= MAX_RETRIEVALS:
        return "generate"
    return "retrieve"  # re-retrieve with the refined query


def _route_after_critique(state: AgentState) -> str:
    if state.get("acceptable") or state.get("revisions", 0) >= MAX_REVISIONS:
        return "done"
    return "revise"  # regenerate, addressing the critique


def _build_graph():
    g = StateGraph(AgentState)
    # Node names must not collide with AgentState keys - hence "review" (the state
    # already has a `critique` field holding the reviewer's notes).
    g.add_node("retrieve", _retrieve)
    g.add_node("grade", _grade)
    g.add_node("generate", _generate)
    g.add_node("review", _critique)

    g.add_edge(START, "retrieve")
    g.add_edge("retrieve", "grade")
    g.add_conditional_edges(
        "grade", _route_after_grade, {"retrieve": "retrieve", "generate": "generate"}
    )
    g.add_edge("generate", "review")
    g.add_conditional_edges(
        "review", _route_after_critique, {"revise": "generate", "done": END}
    )
    return g.compile()


# Compiled once at import; safe to reuse across requests.
_GRAPH = _build_graph()


async def analyze_resume_agent(
    resume_id: int,
    job_description: str,
    api_key: str | None = None,
    provider: str | None = None,
) -> tuple[MatchReport, list[str]]:
    """Run the agentic graph. Returns the report and the step trace it took."""
    final: AgentState = await _GRAPH.ainvoke(
        {
            "resume_id": resume_id,
            "job_description": job_description,
            "api_key": api_key,
            "provider": provider,
            "query": job_description,
            "retrievals": 0,
            "revisions": 0,
        }
    )
    return final["report"], final.get("steps", [])
