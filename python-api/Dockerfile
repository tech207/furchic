# syntax=docker/dockerfile:1
FROM python:3.12-slim

# ── System dependencies for Pillow (libpng, libjpeg, zlib) ────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpng-dev \
        libjpeg-dev \
        zlib1g-dev \
        libfreetype6-dev \
        libwebp-dev \
    && rm -rf /var/lib/apt/lists/*

# ── Working directory ─────────────────────────────────────────────────────────
WORKDIR /app

# ── Dependencies (separate layer for caching) ─────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Application code ──────────────────────────────────────────────────────────
COPY . .

# Ensure asset directories exist even if not checked in
RUN mkdir -p fonts templates

# ── Non-root user (security) ──────────────────────────────────────────────────
RUN useradd --create-home --uid 1000 appuser \
    && chown -R appuser:appuser /app

USER appuser

# ── Runtime ───────────────────────────────────────────────────────────────────
EXPOSE 8000

# Railway sets $PORT; fall back to 8000 for local runs
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2"]
