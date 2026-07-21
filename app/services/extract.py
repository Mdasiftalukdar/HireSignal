"""Extract plain text from an uploaded resume - PDF, DOCX, or TXT/MD."""

import io

from docx import Document
from pypdf import PdfReader

# Accepted upload extensions (str.endswith accepts this tuple directly).
SUPPORTED = (".pdf", ".docx", ".txt", ".md")


def _from_pdf(data: bytes) -> str:
    reader = PdfReader(io.BytesIO(data))
    return "\n".join((page.extract_text() or "") for page in reader.pages).strip()


def _from_docx(data: bytes) -> str:
    document = Document(io.BytesIO(data))
    return "\n".join(p.text for p in document.paragraphs).strip()


def extract_text(filename: str, data: bytes) -> str:
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        return _from_pdf(data)
    if name.endswith(".docx"):
        return _from_docx(data)
    if name.endswith((".txt", ".md")):
        return data.decode("utf-8", errors="ignore").strip()
    raise ValueError("Unsupported file type. Please upload PDF, DOCX, or TXT.")
