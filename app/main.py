"""HireSignal API entrypoint.

Phase 1: prove the container can reach PostgreSQL and Redis over the Docker
network. The `/health` endpoint pings both dependencies and reports per-service
status - the standard way to make a service observable and orchestration-friendly.
"""

import logging

import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings

logging.basicConfig(level=settings.log_level.upper())
logger = logging.getLogger("hiresignal")

app = FastAPI(
    title="HireSignal API",
    version="0.1.0",
    description="AI-powered job application tracker & resume analyzer.",
)

# Created once at import time and reused. The engine manages a connection pool;
# `pool_pre_ping` transparently discards dead connections before use.
engine = create_async_engine(settings.database_url, pool_pre_ping=True)
redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)


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
