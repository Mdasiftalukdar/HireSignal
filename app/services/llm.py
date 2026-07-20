"""Provider-agnostic LLM factory.

The rest of the app calls `get_chat_model()` and never hard-codes a vendor. Switching
providers is a change to LLM_PROVIDER in .env - nothing else. Provider SDKs are imported
lazily so you only need the package for the provider you actually use.
"""

from langchain_core.language_models import BaseChatModel

from app.core.config import settings


def get_chat_model(temperature: float = 0.0) -> BaseChatModel:
    provider = settings.llm_provider.lower()

    if provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=settings.gemini_model,
            google_api_key=settings.google_api_key,
            temperature=temperature,
            max_retries=0,  # fail fast on free-tier 429s instead of blocking on backoff
        )

    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(
            model=settings.anthropic_model,
            api_key=settings.anthropic_api_key,
            temperature=temperature,
        )

    raise ValueError(f"Unsupported LLM_PROVIDER: {settings.llm_provider!r}")
