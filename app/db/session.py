"""Async database engine + session factory.

The engine owns a pool of connections and is created once for the whole app.
`get_db` is a FastAPI dependency that hands each request its own session and
guarantees the session is closed afterwards (Phase 3 endpoints will use it).
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(settings.database_url, pool_pre_ping=True, echo=False)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
