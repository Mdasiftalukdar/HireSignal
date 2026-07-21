# syntax=docker/dockerfile:1

# ============================================================
# Stage 1 - builder: install dependencies into an isolated prefix
# ============================================================
FROM python:3.12-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# gcc is only needed if a dependency must compile from source.
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc \
    && rm -rf /var/lib/apt/lists/*

# Heavy, rarely-changing ML deps first -> this layer stays cached when app deps change.
COPY requirements-ml.txt .
RUN pip install --prefix=/install -r requirements-ml.txt
# Lighter, fast-changing app deps second.
COPY requirements.txt .
RUN pip install --prefix=/install -r requirements.txt

# ============================================================
# Stage 2 - runtime: slim final image, no build tools
# ============================================================
FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

WORKDIR /app

# Bring in only the installed packages, none of the build toolchain.
COPY --from=builder /install /usr/local

# Run as a non-root user (security best practice).
RUN useradd --create-home --uid 1000 appuser
COPY --chown=appuser:appuser app ./app
COPY --chown=appuser:appuser alembic ./alembic
COPY --chown=appuser:appuser alembic.ini ./
USER appuser

EXPOSE 8000

# Production command (compose overrides this with --reload for local dev).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
