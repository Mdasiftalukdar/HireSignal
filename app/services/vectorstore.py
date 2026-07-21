"""ChromaDB vector store (embedded, persisted to a mounted volume).

We supply our own embeddings (from sentence-transformers), so Chroma is used purely as a
similarity index. Each chunk is tagged with its `resume_id` so we can store many resumes in
one collection and filter retrieval to a single resume.
"""

from functools import lru_cache

import chromadb

from app.core.config import settings


@lru_cache(maxsize=1)
def _client():
    return chromadb.PersistentClient(path=settings.chroma_persist_dir)


def _collection():
    return _client().get_or_create_collection(
        name=settings.chroma_collection, metadata={"hnsw:space": "cosine"}
    )


def upsert_chunks(
    resume_id: int, chunks: list[str], embeddings: list[list[float]]
) -> None:
    col = _collection()
    # Replace any previously-indexed chunks for this resume, then add the fresh set.
    col.delete(where={"resume_id": resume_id})
    col.add(
        ids=[f"resume-{resume_id}-chunk-{i}" for i in range(len(chunks))],
        documents=chunks,
        embeddings=embeddings,
        metadatas=[
            {"resume_id": resume_id, "chunk_index": i} for i in range(len(chunks))
        ],
    )


def query_resume(
    resume_id: int, query_embedding: list[float], top_k: int
) -> list[str]:
    result = _collection().query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        where={"resume_id": resume_id},
    )
    documents = result.get("documents") or [[]]
    return documents[0]
