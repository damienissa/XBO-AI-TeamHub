"""Utilities for extracting plain text from uploaded files."""

import io
from pathlib import Path

ALLOWED_CONTENT_TYPES = frozenset(
    {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "text/markdown",
        "text/x-markdown",
    }
)

# Extension → MIME fallback for browsers that report application/octet-stream
_EXT_MIME: dict[str, str] = {
    ".md": "text/markdown",
    ".markdown": "text/markdown",
    ".txt": "text/plain",
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def resolve_content_type(content_type: str, filename: str) -> str:
    """Return the effective MIME type, using extension fallback for octet-stream."""
    if content_type != "application/octet-stream":
        return content_type
    ext = Path(filename).suffix.lower()
    return _EXT_MIME.get(ext, content_type)

MAX_EXTRACT_CHARS = 15_000
AI_CONTEXT_CHARS = 8_000


def extract_text(data: bytes, content_type: str) -> str:
    """Return plain text (up to MAX_EXTRACT_CHARS) from file bytes."""
    if content_type in ("text/plain", "text/markdown", "text/x-markdown"):
        return data.decode("utf-8", errors="replace")[:MAX_EXTRACT_CHARS]

    if content_type == "application/pdf":
        import pypdf  # lazy import — only needed when processing PDFs

        reader = pypdf.PdfReader(io.BytesIO(data))
        parts: list[str] = []
        total = 0
        for page in reader.pages:
            page_text = page.extract_text() or ""
            parts.append(page_text)
            total += len(page_text)
            if total >= MAX_EXTRACT_CHARS:
                break
        return " ".join(parts)[:MAX_EXTRACT_CHARS]

    if content_type == (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ):
        from docx import Document  # lazy import — only needed for DOCX

        doc = Document(io.BytesIO(data))
        text = "\n".join(p.text for p in doc.paragraphs)
        return text[:MAX_EXTRACT_CHARS]

    return ""
