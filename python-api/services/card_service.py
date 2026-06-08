"""
Card image composition service.
Card dimensions: 1012 × 638 px  (85.6 × 54 mm @ 300 DPI, CR-80 standard)
Output: PNG, RGB
"""
import io
from pathlib import Path
from typing import Optional

import httpx
from PIL import Image, ImageDraw, ImageFilter

from .font_service import get_font

# ── Constants ─────────────────────────────────────────────────────────────────

CARD_W, CARD_H = 1012, 638
MARGIN = 44

# Brand palette
ORANGE     = (232, 130,  12)   # #E8820C
AMBER      = (245, 158,  11)   # #F59E0B
ORANGE_MID = (238, 144,  11)   # blend for variety
WHITE      = (255, 255, 255)
OFF_WHITE  = (248, 248, 248)
DARK       = ( 28,  28,  28)
GRAY       = (100, 100, 100)
LIGHT_GRAY = (200, 200, 200)
ORANGE_DIM = (232, 130,  12, 140)   # semi-transparent for divider

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"

# ── Helpers ───────────────────────────────────────────────────────────────────

async def _download_image(url: str) -> Image.Image:
    """Download an image with 10-second timeout."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, follow_redirects=True)
        resp.raise_for_status()
    return Image.open(io.BytesIO(resp.content))


def _gradient_bg(width: int, height: int, c1: tuple, c2: tuple) -> Image.Image:
    """Horizontal left→right linear gradient (RGB)."""
    img = Image.new("RGB", (width, height))
    for x in range(width):
        t = x / max(width - 1, 1)
        color = tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))
        strip = Image.new("RGB", (1, height), color)
        img.paste(strip, (x, 0))
    return img


def _load_template(filename: str) -> Optional[Image.Image]:
    """Load an image from the templates directory (returns None if missing)."""
    path = TEMPLATES_DIR / filename
    if not path.exists():
        return None
    try:
        return Image.open(path)
    except Exception:
        return None


def _resize_contain(img: Image.Image, max_w: int, max_h: int) -> Image.Image:
    """Scale image to fit inside max_w × max_h, preserving aspect ratio."""
    img = img.copy()
    img.thumbnail((max_w, max_h), Image.LANCZOS)
    return img


def _composite_rgba(base: Image.Image, overlay: Image.Image, pos: tuple) -> Image.Image:
    """Composite an RGBA overlay onto an RGB base at position (x, y)."""
    base_rgba = base.convert("RGBA")
    base_rgba.paste(overlay, pos, mask=overlay.split()[3] if overlay.mode == "RGBA" else None)
    return base_rgba.convert("RGB")


def _draw_text_shadow(
    draw: ImageDraw.Draw,
    pos: tuple,
    text: str,
    font,
    fill: tuple,
    shadow_offset: int = 2,
    shadow_alpha: int = 60,
):
    """Draw text with a subtle drop shadow."""
    sx, sy = pos[0] + shadow_offset, pos[1] + shadow_offset
    draw.text((sx, sy), text, font=font, fill=(0, 0, 0, shadow_alpha))
    draw.text(pos, text, font=font, fill=fill)


# ── Front card ────────────────────────────────────────────────────────────────

def _build_front(
    pet_photo: Optional[Image.Image],
    qr_badge: Image.Image,
) -> Image.Image:
    # 1. Gradient background
    card = _gradient_bg(CARD_W, CARD_H, ORANGE, AMBER)

    # 2. Subtle vignette overlay (darken top-left slightly for text contrast)
    vignette = Image.new("RGBA", (CARD_W, CARD_H), (0, 0, 0, 0))
    v_draw = ImageDraw.Draw(vignette)
    for i in range(CARD_W // 2):
        alpha = int(55 * (1 - i / (CARD_W // 2)))
        v_draw.line([(i, 0), (i, CARD_H)], fill=(0, 0, 0, alpha))
    card = _composite_rgba(card, vignette, (0, 0))

    # 3. Pet photo (right 45%, full height, transparent background)
    if pet_photo is not None:
        photo_area_w = 460
        photo_area_h = CARD_H + 20  # slight bleed
        photo = pet_photo.convert("RGBA")
        photo = _resize_contain(photo, photo_area_w, photo_area_h)

        # Soft left-edge fade so photo blends into gradient
        fade_w = 80
        fade_mask = Image.new("L", photo.size, 255)
        for x in range(min(fade_w, photo.width)):
            alpha = int(255 * (x / fade_w) ** 1.5)
            strip = Image.new("L", (1, photo.height), alpha)
            fade_mask.paste(strip, (x, 0))

        # Merge fade with photo's own alpha (pure Pillow, no numpy)
        if photo.mode == "RGBA":
            orig_alpha = photo.split()[3]
            # Multiply the two alpha channels pixel-by-pixel
            combined = Image.new("L", photo.size)
            oa = orig_alpha.load()
            fm = fade_mask.load()
            cb = combined.load()
            for py_ in range(photo.height):
                for px_ in range(photo.width):
                    cb[px_, py_] = int(oa[px_, py_] * fm[px_, py_] / 255)
            photo.putalpha(combined)
        else:
            photo = photo.convert("RGBA")
            photo.putalpha(fade_mask)

        px = CARD_W - photo.width - 8
        py = (CARD_H - photo.height) // 2
        card = _composite_rgba(card, photo, (px, py))

    draw = ImageDraw.Draw(card)

    # 4. Logo (top-left)
    logo = _load_template("logo.png") or _load_template("logo_white.png")
    if logo is not None:
        logo_h = 58
        logo_w = int(logo.width * (logo_h / logo.height))
        logo_resized = logo.resize((logo_w, logo_h), Image.LANCZOS)
        card = _composite_rgba(card, logo_resized.convert("RGBA"), (MARGIN, MARGIN - 4))
        draw = ImageDraw.Draw(card)
    else:
        # Text fallback
        font_brand = get_font(34, bold=True)
        draw.text((MARGIN, MARGIN - 2), "Furchic", font=font_brand, fill=WHITE)

    # 5. Main headline
    font_title = get_font(82, bold=True)
    font_sub   = get_font(26)

    title_x = MARGIN
    draw.text((title_x, 148), "我的寵物", font=font_title, fill=WHITE)
    draw.text((title_x, 242), "獨自在家", font=font_title, fill=WHITE)

    # Thin divider
    draw.line([(title_x, 342), (title_x + 460, 342)], fill=(255, 255, 255, 80), width=1)

    # 6. Subtitle (3 lines)
    subtitle_lines = [
        "如本人發生意外或需緊急送醫，",
        "請協助聯絡以下緊急聯絡人",
        "並陪同本人的寵物，謝謝。",
    ]
    y = 362
    for line in subtitle_lines:
        draw.text((title_x, y), line, font=font_sub, fill=(255, 255, 255))
        bbox = draw.textbbox((0, 0), line, font=font_sub)
        y += (bbox[3] - bbox[1]) + 10

    # 7. QR code badge (bottom-right)
    qr_x = CARD_W - MARGIN - qr_badge.width
    qr_y = CARD_H - MARGIN - qr_badge.height
    card = _composite_rgba(card, qr_badge.convert("RGBA"), (qr_x, qr_y))

    return card.convert("RGB")


# ── Back card ─────────────────────────────────────────────────────────────────

def _build_back(qr_badge: Image.Image, domain: str) -> Image.Image:
    card = Image.new("RGB", (CARD_W, CARD_H), OFF_WHITE)
    draw = ImageDraw.Draw(card)

    CORNER_SIZE = 68
    CORNER_RADIUS = 14
    CORNER_COLOR = ORANGE

    # 1. Orange corner decorations (filled rounded rectangles)
    corners = [
        (MARGIN - 8,            MARGIN - 8),                            # top-left
        (CARD_W - MARGIN - CORNER_SIZE + 8, MARGIN - 8),                # top-right
        (MARGIN - 8,            CARD_H - MARGIN - CORNER_SIZE + 8),     # bottom-left
        (CARD_W - MARGIN - CORNER_SIZE + 8, CARD_H - MARGIN - CORNER_SIZE + 8),  # bottom-right
    ]
    for cx, cy in corners:
        draw.rounded_rectangle(
            [(cx, cy), (cx + CORNER_SIZE, cy + CORNER_SIZE)],
            radius=CORNER_RADIUS,
            fill=CORNER_COLOR,
        )

    # 2. Title block (center)
    font_title_cn  = get_font(52, bold=True)
    font_title_en  = get_font(20)
    font_label     = get_font(22, bold=True)
    font_line_text = get_font(20)
    font_footer    = get_font(18)

    title_cn = "寵物緊急聯絡卡"
    title_en = "ICE EMERGENCY CARD"

    bbox_cn = draw.textbbox((0, 0), title_cn, font=font_title_cn)
    bbox_en = draw.textbbox((0, 0), title_en, font=font_title_en)
    cn_w = bbox_cn[2] - bbox_cn[0]
    en_w = bbox_en[2] - bbox_en[0]

    title_y = 62
    draw.text(((CARD_W - cn_w) // 2, title_y), title_cn, font=font_title_cn, fill=DARK)
    draw.text(((CARD_W - en_w) // 2, title_y + 64), title_en, font=font_title_en, fill=GRAY)

    # Thin orange underline for title
    line_w = max(cn_w, en_w) + 40
    lx = (CARD_W - line_w) // 2
    draw.line([(lx, title_y + 92), (lx + line_w, title_y + 92)], fill=ORANGE, width=2)

    # 3. Decorative field lines (no personal data)
    fields = [
        ("飼主姓名", "Pet Owner"),
        ("緊急電話", "Emergency Contact"),
        ("就醫醫院", "Veterinary Hospital"),
        ("晶片號碼", "Microchip No."),
        ("特殊需求", "Special Requirements"),
    ]

    field_x_start = MARGIN + CORNER_SIZE + 12
    field_x_end   = CARD_W - MARGIN - CORNER_SIZE - 12
    field_y_start = 178
    field_gap     = 54

    for i, (label_zh, label_en) in enumerate(fields):
        fy = field_y_start + i * field_gap
        # Label
        label_text = f"{label_zh}"
        draw.text((field_x_start, fy), label_text, font=font_label, fill=ORANGE)
        # En label (small, gray)
        bbox_lbl = draw.textbbox((0, 0), label_text, font=font_label)
        lbl_w = bbox_lbl[2] - bbox_lbl[0]
        draw.text((field_x_start + lbl_w + 8, fy + 4), label_en, font=font_line_text, fill=LIGHT_GRAY)
        # Horizontal line
        line_y = fy + 30
        draw.line([(field_x_start, line_y), (field_x_end, line_y)], fill=LIGHT_GRAY, width=1)

    # 4. Footer: Logo + QR + domain
    footer_y = CARD_H - MARGIN - 8 - qr_badge.height

    logo = _load_template("logo.png") or _load_template("logo_color.png")
    logo_x = MARGIN + CORNER_SIZE + 10

    if logo is not None:
        logo_h = 44
        logo_w = int(logo.width * (logo_h / logo.height))
        logo_resized = logo.resize((logo_w, logo_h), Image.LANCZOS)
        card = _composite_rgba(card, logo_resized.convert("RGBA"), (logo_x, footer_y + (qr_badge.height - logo_h) // 2))
        draw = ImageDraw.Draw(card)
        qr_x = logo_x + logo_w + 16
    else:
        # Text fallback
        draw.text((logo_x, footer_y + 8), "Furchic", font=get_font(26, bold=True), fill=ORANGE)
        qr_x = logo_x + 100

    # QR badge (small version)
    card = _composite_rgba(card, qr_badge.convert("RGBA"), (qr_x, footer_y))
    draw = ImageDraw.Draw(card)

    # Domain text (right of footer)
    domain_text = f"www.{domain}"
    bbox_d = draw.textbbox((0, 0), domain_text, font=font_footer)
    domain_w = bbox_d[2] - bbox_d[0]
    domain_x = CARD_W - MARGIN - CORNER_SIZE - 16 - domain_w
    domain_y = footer_y + qr_badge.height - (bbox_d[3] - bbox_d[1]) - 4
    draw.text((domain_x, domain_y), domain_text, font=font_footer, fill=GRAY)

    return card.convert("RGB")


# ── Public entry point ────────────────────────────────────────────────────────

async def generate_card_images(
    uuid: str,
    pet_ai_photo_url: str,
    qr_badge_front: Image.Image,
    qr_badge_back: Image.Image,
    domain: str,
) -> tuple[Image.Image, Image.Image]:
    """
    Download pet photo, compose front & back card images.

    Returns:
        (front_image, back_image) as RGB Pillow Images.
    """
    pet_photo: Optional[Image.Image] = None
    try:
        pet_photo = await _download_image(pet_ai_photo_url)
    except Exception as e:
        # Non-fatal: generate card without photo
        import logging
        logging.warning("Failed to download pet photo (%s): %s", pet_ai_photo_url, e)

    front = _build_front(pet_photo, qr_badge_front)
    back  = _build_back(qr_badge_back, domain)

    return front, back
