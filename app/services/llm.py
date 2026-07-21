"""Provider-agnostic LLM factory with an ordered fallback chain.

`get_chat_model(provider)` builds one chat model for a named provider. `provider_order()`
returns the primary provider followed by any configured fallbacks that actually have an API
key set - callers wrap a runnable with `.with_fallbacks(...)` (see job_parser) so a failure
of the primary automatically retries on the next provider.

Reordering/switching providers is a change to LLM_PROVIDER / LLM_FALLBACK_PROVIDERS in .env.
Provider SDKs are imported lazily. OpenRouter and DeepSeek are both OpenAI-API compatible, so
they reuse `ChatOpenAI` with a custom base URL.
"""

from langchain_core.language_models import BaseChatModel

from app.core.config import settings

_KEY_ATTR = {
    "openrouter": "openrouter_api_key",
    "google": "google_api_key",
    "anthropic": "anthropic_api_key",
    "deepseek": "deepseek_api_key",
}


def _has_key(provider: str) -> bool:
    attr = _KEY_ATTR.get(provider)
    return bool(attr and getattr(settings, attr, None))


def get_chat_model(provider: str, temperature: float = 0.0) -> BaseChatModel:
    provider = provider.lower()

    if provider == "openrouter":
        # OpenRouter is OpenAI-API compatible - one key, many upstream models.
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=settings.openrouter_model,
            api_key=settings.openrouter_api_key,
            base_url=settings.openrouter_base_url,
            temperature=temperature,
            max_retries=0,
        )

    if provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=settings.gemini_model,
            google_api_key=settings.google_api_key,
            temperature=temperature,
            max_retries=0,  # fail fast so the fallback engages promptly
        )

    if provider == "deepseek":
        # DeepSeek is OpenAI-API compatible too.
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=settings.deepseek_model,
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
            temperature=temperature,
            max_retries=0,
        )

    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(
            model=settings.anthropic_model,
            api_key=settings.anthropic_api_key,
            temperature=temperature,
        )

    raise ValueError(f"Unsupported LLM provider: {provider!r}")


def provider_order() -> list[str]:
    """Primary provider first, then configured fallbacks; only those with an API key."""
    order = [settings.llm_provider]
    order += [p.strip() for p in settings.llm_fallback_providers.split(",") if p.strip()]
    seen: set[str] = set()
    result: list[str] = []
    for provider in (p.lower() for p in order):
        if provider and provider not in seen and _has_key(provider):
            seen.add(provider)
            result.append(provider)
    return result
