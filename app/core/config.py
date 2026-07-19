"""Application configuration.

Values are read from environment variables (injected by docker compose via the
`.env` file). Pydantic validates and type-casts them, so a missing or malformed
value fails loudly at startup instead of surfacing as a mysterious runtime bug.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # extra="ignore" lets later-phase variables live in .env without breaking now.
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_env: str = "development"
    app_port: int = 8000
    log_level: str = "info"

    # Dependencies (required - startup fails if absent)
    database_url: str
    redis_url: str

    # Caching (used from Phase 3)
    cache_ttl_seconds: int = 300


# Import this singleton everywhere: `from app.core.config import settings`
settings = Settings()
