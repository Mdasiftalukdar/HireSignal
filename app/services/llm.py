"""Provider-agnostic LLM factory with an ordered fallback chain.

`get_chat_model(provider, api_key=...)` builds one chat model. When `api_key` is given
(a user's bring-your-own key) it is used instead of the server's configured key.
`provider_order()` returns the server's primary + configured fallbacks that have a key.

OpenRouter, OpenAI, and DeepSeek all speak the OpenAI API, so they reuse `ChatOpenAI`
with a different base URL. Provider SDKs are imported lazily.
"""

from langchain_core.language_models import BaseChatModel

from app.core.config import settings

_KEY_ATTR = {
    "openrouter": "openrouter_api_key",
    "openai": "openai_api_key",
    "google": "google_api_key",
    "anthropic": "anthropic_api_key",
    "deepseek": "deepseek_api_key",
    "groq": "groq_api_key",
    "mistral": "mistral_api_key",
    "together": "together_api_key",
    "xai": "xai_api_key",
    "perplexity": "perplexity_api_key",
}

# Providers that speak the OpenAI API - reuse ChatOpenAI with a different base URL.
# Maps provider -> (model setting, base-URL setting, server-key setting).
_OPENAI_COMPATIBLE = {
    "groq": ("groq_model", "groq_base_url", "groq_api_key"),
    "mistral": ("mistral_model", "mistral_base_url", "mistral_api_key"),
    "together": ("together_model", "together_base_url", "together_api_key"),
    "xai": ("xai_model", "xai_base_url", "xai_api_key"),
    "perplexity": ("perplexity_model", "perplexity_base_url", "perplexity_api_key"),
}


def _has_key(provider: str) -> bool:
    attr = _KEY_ATTR.get(provider)
    return bool(attr and getattr(settings, attr, None))


def get_chat_model(
    provider: str, api_key: str | None = None, temperature: float = 0.0
) -> BaseChatModel:
    provider = provider.lower()

    if provider == "openrouter":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=settings.openrouter_model,
            api_key=api_key or settings.openrouter_api_key,
            base_url=settings.openrouter_base_url,
            temperature=temperature,
            max_retries=0,
        )

    if provider == "openai":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=settings.openai_model,
            api_key=api_key or settings.openai_api_key,
            temperature=temperature,
            max_retries=0,
        )

    if provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=settings.gemini_model,
            google_api_key=api_key or settings.google_api_key,
            temperature=temperature,
            max_retries=0,
        )

    if provider == "deepseek":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=settings.deepseek_model,
            api_key=api_key or settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
            temperature=temperature,
            max_retries=0,
        )

    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(
            model=settings.anthropic_model,
            api_key=api_key or settings.anthropic_api_key,
            temperature=temperature,
        )

    if provider in _OPENAI_COMPATIBLE:
        from langchain_openai import ChatOpenAI

        model_attr, base_attr, key_attr = _OPENAI_COMPATIBLE[provider]
        return ChatOpenAI(
            model=getattr(settings, model_attr),
            api_key=api_key or getattr(settings, key_attr),
            base_url=getattr(settings, base_attr),
            temperature=temperature,
            max_retries=0,
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
