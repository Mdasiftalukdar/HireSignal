from app.services.chunking import chunk_text


def test_chunks_split_long_text():
    text = " ".join(str(i) for i in range(1000))
    chunks = chunk_text(text, size=100, overlap=10)
    assert len(chunks) > 1
    assert all(chunks)  # no empty chunks


def test_empty_text_returns_no_chunks():
    assert chunk_text("") == []
    assert chunk_text("   ") == []


def test_overlap_shares_words_between_chunks():
    words = [f"w{i}" for i in range(30)]
    chunks = chunk_text(" ".join(words), size=10, overlap=5)
    assert len(chunks) >= 2
    # the last 5 words of chunk 0 should reappear at the start of chunk 1
    first_tail = chunks[0].split()[-5:]
    second_head = chunks[1].split()[:5]
    assert first_tail == second_head
