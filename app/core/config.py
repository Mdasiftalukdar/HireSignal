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

    # Security / JWT
    secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # Caching (used from Phase 3)
    cache_ttl_seconds: int = 300

    # LLM (Phase 4) - provider-agnostic with automatic fallback
    llm_provider: str = "openrouter"
    llm_fallback_providers: str = "google,deepseek"  # tried in order on failure
    openrouter_api_key: str | None = None
    openrouter_model: str = "openai/gpt-4o-mini"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    google_api_key: str | None = None
    gemini_model: str = "gemini-2.0-flash-lite"
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-sonnet-5"
    deepseek_api_key: str | None = None
    deepseek_model: str = "deepseek-chat"
    deepseek_base_url: str = "https://api.deepseek.com"


# Import this singleton everywhere: `from app.core.config import settings`
settings = Settings()
