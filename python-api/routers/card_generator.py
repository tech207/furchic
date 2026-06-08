import os
import logging
from fastapi import APIRouter, HTTPException

from models.card import CardRequest, CardResponse
from services.card_service import generate_card_images
from services.qr_service import generate_qr_badge, qr_to_bytes
from services.supabase_service import upload_image, upload_bytes

logger = logging.getLogger(__name__)
router = APIRouter(tags=["card"])

BUCKET = os.getenv("CARD_STORAGE_BUCKET", "card-prints")
DOMAIN = os.getenv("DOMAIN", "furchic.com")
APP_URL = os.getenv("APP_URL", f"https://{DOMAIN}")


@router.post("/generate-card", response_model=CardResponse, status_code=202)
async def generate_card(req: CardRequest) -> CardResponse:
    """
    Compose NFC card front + back + QR code PNG files and upload to Supabase Storage.

    - Validates UUID format (model layer)
    - Downloads pet AI photo (transparent bg, 10s timeout)
    - Generates QR code pointing to /pet/{uuid}
    - Composes front (gradient + photo + QR) and back (white + fields + QR)
    - Uploads 3 PNGs to Supabase Storage: {uuid}/front.png, back.png, qr.png
    - Returns public URLs
    """
    pet_url = f"{APP_URL}/pet/{req.uuid}"

    try:
        # 1. QR code (two sizes: front 136px, back 112px)
        qr_front  = generate_qr_badge(pet_url, badge_size=136)
        qr_back   = generate_qr_badge(pet_url, badge_size=112)
        qr_bytes  = qr_to_bytes(pet_url, badge_size=200)

        # 2. Compose cards
        front_img, back_img = await generate_card_images(
            uuid=req.uuid,
            pet_ai_photo_url=req.pet_ai_photo_url,
            qr_badge_front=qr_front,
            qr_badge_back=qr_back,
            domain=DOMAIN,
        )

        # 3. Upload to Supabase Storage
        front_url, back_url, qr_url = await _upload_all(
            req.uuid, front_img, back_img, qr_bytes
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Card generation failed for uuid=%s", req.uuid)
        raise HTTPException(status_code=500, detail=f"Card generation failed: {exc}") from exc

    return CardResponse(front_url=front_url, back_url=back_url, qr_url=qr_url)


async def _upload_all(uuid: str, front, back, qr_bytes: bytes):
    import asyncio

    front_task = upload_image(front, BUCKET, f"{uuid}/front.png")
    back_task  = upload_image(back,  BUCKET, f"{uuid}/back.png")
    qr_task    = upload_bytes(qr_bytes, BUCKET, f"{uuid}/qr.png")

    front_url, back_url, qr_url = await asyncio.gather(front_task, back_task, qr_task)
    return front_url, back_url, qr_url
