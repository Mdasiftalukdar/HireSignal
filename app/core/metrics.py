"""Prometheus metrics.

Default HTTP metrics (request count, latency histogram, in-progress gauge) come from the
FastAPI instrumentator. On top of that we define a couple of *domain* metrics that a generic
instrumentator can't know about: cache hit/miss and AI processing time.
"""

from prometheus_client import Counter, Histogram
from prometheus_fastapi_instrumentator import Instrumentator

# Cache effectiveness: increment on every cache lookup, labelled hit vs miss.
cache_events = Counter(
    "hiresignal_cache_events_total",
    "Cache lookups by resource and result",
    ["resource", "result"],
)

# How long the AI pipeline takes (embedding + retrieval + LLM), by operation.
ai_processing_seconds = Histogram(
    "hiresignal_ai_processing_seconds",
    "Time spent in an AI processing operation",
    ["operation"],
)


def setup_metrics(app) -> None:
    """Add default HTTP metrics middleware and expose GET /metrics for Prometheus."""
    Instrumentator().instrument(app).expose(
        app, endpoint="/metrics", include_in_schema=False
    )
