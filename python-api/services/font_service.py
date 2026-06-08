"""Font loader with graceful fallback to system fonts then PIL default."""
from functools import lru_cache
from pathlib import Path
from PIL import ImageFont

FONTS_DIR = Path(__file__).parent.parent / "fonts"

# System fallback paths (Debian/Ubuntu, Alpine, macOS)
_SYSTEM_FALLBACKS = [
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJKtc-Bold.otf",
    "/usr/share/fonts/truetype/noto/NotoSansCJKtc-Regular.otf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def _resolve_font_path(bold: bool) -> str | None:
    filename = "NotoSansTC-Bold.ttf" if bold else "NotoSansTC-Regular.ttf"
    local = FONTS_DIR / filename
    if local.exists():
        return str(local)
    for path in _SYSTEM_FALLBACKS:
        if Path(path).exists():
            return path
    return None


@lru_cache(maxsize=64)
def get_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    path = _resolve_font_path(bold)
    if path:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    # Final fallback: PIL default (no CJK, but won't crash)
    return ImageFont.load_default()
