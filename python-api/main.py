"""
Pet.chic Weekend Card Generator — FastAPI microservice
Generates NFC card front/back PNG images + QR codes.

Required env vars:
  PYTHON_API_KEY          — shared secret for X-API-Key auth
  SUPABASE_URL            — Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY — Supabase service role key
  ALLOWED_ORIGINS         — comma-separated CORS origins
  DOMAIN                  — furchic.com (for QR code URL and card text)
  APP_URL                 — https://furchic.com (full URL base)
  CARD_STORAGE_BUCKET     — Supabase Storage bucket name (default: card-prints)
"""
import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader

from routers import card_generator, health

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

# ── API-key auth ──────────────────────────────────────────────────────────────

_API_KEY = os.environ.get("PYTHON_API_KEY", "")
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=True)


async def require_api_key(key: str = Security(_api_key_header)) -> str:
    if not _API_KEY:
        raise RuntimeError("PYTHON_API_KEY is not configured")
    if key != _API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")
    return key


# ── App lifecycle ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.getLogger(__name__).info("Pet.chic Weekend card generator started")
    yield
    logging.getLogger(__name__).info("Pet.chic Weekend card generator stopped")


# ── App factory ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="Pet.chic Weekend Card Generator",
    version="1.0.0",
    description="NFC card image generation microservice",
    docs_url="/docs",
    redoc_url=None,
    lifespan=lifespan,
)

# CORS: restrict to Next.js server origins only
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key"],
)

# ── Routes ────────────────────────────────────────────────────────────────────

# Health endpoint — no auth required (used by Railway health checks)
app.include_router(health.router)

# Card generation — requires X-API-Key
app.include_router(
    card_generator.router,
    dependencies=[Depends(require_api_key)],
)
