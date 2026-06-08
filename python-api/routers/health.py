from fastapi import APIRouter
from pathlib import Path

router = APIRouter(tags=["system"])

FONTS_DIR = Path(__file__).parent.parent / "fonts"
TEMPLATES_DIR = Path(__file__).parent.parent / "templates"


@router.get("/health")
async def health() -> dict:
    fonts_ok = (FONTS_DIR / "NotoSansTC-Bold.ttf").exists()
    logo_ok  = (TEMPLATES_DIR / "logo.png").exists() or (TEMPLATES_DIR / "logo_white.png").exists()
    return {
        "status": "ok",
        "fonts_loaded": fonts_ok,
        "logo_found": logo_ok,
    }
