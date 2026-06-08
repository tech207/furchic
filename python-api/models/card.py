from pydantic import BaseModel, field_validator
import re

UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)


class CardRequest(BaseModel):
    uuid: str
    pet_name: str
    pet_ai_photo_url: str  # RGBA PNG with transparent background (from remove-bg)

    @field_validator("uuid")
    @classmethod
    def validate_uuid(cls, v: str) -> str:
        if not UUID_RE.match(v):
            raise ValueError("uuid must be a valid UUID v4")
        return v.lower()

    @field_validator("pet_name")
    @classmethod
    def validate_pet_name(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) > 50:
            raise ValueError("pet_name must be 1–50 characters")
        return v

    @field_validator("pet_ai_photo_url")
    @classmethod
    def validate_photo_url(cls, v: str) -> str:
        if not v.startswith("https://"):
            raise ValueError("pet_ai_photo_url must be an https URL")
        return v


class CardResponse(BaseModel):
    front_url: str
    back_url: str
    qr_url: str
