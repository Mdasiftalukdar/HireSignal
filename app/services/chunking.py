"""Split text into overlapping chunks.

We chunk by words (a simple, explainable proxy for tokens). Overlap preserves context
that would otherwise be cut at a boundary - e.g. a skill mentioned across two chunks.
"""

from app.core.config import settings


def chunk_text(
    text: str, size: int | None = None, overlap: int | None = None
) -> list[str]:
    size = size or settings.chunk_size
    overlap = overlap or settings.chunk_overlap
    words = text.split()
    if not words:
        return []

    step = max(1, size - overlap)
    chunks: list[str] = []
    for start in range(0, len(words), step):
        piece = words[start : start + size]
        if piece:
            chunks.append(" ".join(piece))
        if start + size >= len(words):
            break
    return chunks
