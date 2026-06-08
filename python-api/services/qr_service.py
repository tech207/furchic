"""QR Code generation as Pillow Image with white badge background."""
import io
import qrcode
from qrcode.constants import ERROR_CORRECT_M
from PIL import Image, ImageDraw


def _make_rounded_white_bg(size: int, radius: int = 12) -> Image.Image:
    """Create a white rounded-rectangle background image (RGBA)."""
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(bg)
    draw.rounded_rectangle([(0, 0), (size - 1, size - 1)], radius=radius, fill=(255, 255, 255, 255))
    return bg


def generate_qr_badge(url: str, badge_size: int = 136) -> Image.Image:
    """
    Generate a QR code as a white-badged RGBA image.

    Args:
        url:        The URL encoded in the QR code.
        badge_size: Total outer size (px) including white padding.

    Returns:
        RGBA Image ready to be composited.
    """
    padding = 10
    qr_size = badge_size - padding * 2

    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_M,
        box_size=8,
        border=3,
    )
    qr.add_data(url)
    qr.make(fit=True)

    qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    qr_img = qr_img.resize((qr_size, qr_size), Image.LANCZOS)

    badge = _make_rounded_white_bg(badge_size)
    badge.paste(qr_img, (padding, padding))
    return badge


def qr_to_bytes(url: str, badge_size: int = 200) -> bytes:
    """Return QR badge as raw PNG bytes (for Supabase upload)."""
    badge = generate_qr_badge(url, badge_size)
    buf = io.BytesIO()
    badge.save(buf, format="PNG", optimize=True)
    return buf.getvalue()
