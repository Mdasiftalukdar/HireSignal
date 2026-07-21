"""Local, free text embeddings via sentence-transformers.

The model (all-MiniLM-L6-v2, ~90 MB) is downloaded once and cached on a mounted volume,
then loaded once per process. `normalize_embeddings=True` gives unit vectors, so cosine
similarity reduces to a dot product - which is what ChromaDB compares.
"""

from functools import lru_cache

from sentence_transformers import SentenceTransformer

from app.core.config import settings


@lru_cache(maxsize=1)
def _model() -> SentenceTransformer:
    return SentenceTransformer(settings.embedding_model)


def embed_texts(texts: list[str]) -> list[list[float]]:
    vectors = _model().encode(texts, normalize_embeddings=True)
    return [v.tolist() for v in vectors]


def embed_query(text: str) -> list[float]:
    return embed_texts([text])[0]
