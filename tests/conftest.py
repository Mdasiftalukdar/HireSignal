"""Test setup: provide dummy env vars so `app.core.config.Settings()` loads without a
real database/redis/secret. Runs before any test module imports app code.
"""

import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://u:p@localhost:5432/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
