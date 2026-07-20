"""Redis cache helpers implementing the cache-aside pattern.

Cache-aside = the application code, not the database, manages the cache:
  read  -> look in Redis first; on a miss, read the DB and populate Redis (with a TTL)
  write -> invalidate the affected cached entries so reads never serve stale data

The client is created once here and shared across the app (routers + health check).
"""

import json
from typing import Any

import redis.asyncio as aioredis

from app.core.config import settings

redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)


async def cache_get_json(key: str) -> Any | None:
    raw = await redis_client.get(key)
    return json.loads(raw) if raw is not None else None


async def cache_set_json(key: str, value: Any, ttl: int | None = None) -> None:
    await redis_client.set(
        key, json.dumps(value), ex=ttl if ttl is not None else settings.cache_ttl_seconds
    )


async def cache_invalidate_prefix(prefix: str) -> None:
    """Delete every key beginning with `prefix` (busts a resource's cached reads)."""
    keys = [key async for key in redis_client.scan_iter(match=f"{prefix}*")]
    if keys:
        await redis_client.delete(*keys)
