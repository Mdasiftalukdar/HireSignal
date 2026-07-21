"""HireSignal API entrypoint.

Phase 1: prove the container can reach PostgreSQL and Redis over the Docker
network. The `/health` endpoint pings both dependencies and reports per-service
status - the standard way to make a service observable and orchestration-friendly.
"""

import logging

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.routes import ai, applications, auth, jobs, resumes
from app.core.cache import redis_client
from app.core.config import settings
from app.core.metrics import setup_metrics
from app.db.session import engine

logging.basicConfig(level=settings.log_level.upper())
logger = logging.getLogger("hiresignal")

app = FastAPI(
    title="HireSignal API",
    version="0.1.0",
    description="AI-powered job application tracker & resume analyzer.",
)

# Mount versioned API routers (endpoints live under /api/v1).
app.include_router(auth.router, prefix="/api/v1")
app.include_router(jobs.router, prefix="/api/v1")
app.include_router(resumes.router, prefix="/api/v1")
app.include_router(applications.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")

# Prometheus: default HTTP metrics middleware + GET /metrics endpoint.
setup_metrics(app)

# The engine (app.db.session) and Redis client (app.core.cache) are each created once
# in their own module and shared across the whole app.


@app.get("/")
async def root():
    return {"service": "HireSignal", "status": "ok", "docs": "/docs"}


@app.get("/health")
async def health():
    """Liveness + dependency check. Returns 200 only if all deps are reachable."""
    services: dict[str, str] = {}

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        services["postgres"] = "ok"
    except Exception as exc:  # noqa: BLE001 - report, never crash the health check
        services["postgres"] = f"error: {exc.__class__.__name__}"

    try:
        services["redis"] = "ok" if await redis_client.ping() else "error: no pong"
    except Exception as exc:  # noqa: BLE001
        services["redis"] = f"error: {exc.__class__.__name__}"

    all_ok = all(v == "ok" for v in services.values())
    return JSONResponse(
        status_code=200 if all_ok else 503,
        content={"status": "ok" if all_ok else "degraded", "services": services},
    )
