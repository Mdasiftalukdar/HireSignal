import pytest

from app.services.extract import extract_text


def test_extract_plain_text():
    assert extract_text("resume.txt", b"Hello world") == "Hello world"


def test_extract_markdown():
    assert extract_text("notes.md", b"# Title\nbody") == "# Title\nbody"


def test_unsupported_type_raises():
    with pytest.raises(ValueError):
        extract_text("resume.xyz", b"data")
