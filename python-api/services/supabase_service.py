"""Supabase Storage helpers (synchronous client, called via asyncio.to_thread)."""
import asyncio
import io
import os
from PIL import Image
from supabase import create_client, Client


def _get_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def _upload_bytes_sync(client: Client, bucket: str, path: str, data: bytes) -> str:
    """Upload raw bytes and return the public URL."""
    client.storage.from_(bucket).upload(
        path,
        data,
        file_options={"content-type": "image/png", "upsert": "true"},
    )
    return client.storage.from_(bucket).get_public_url(path)


async def upload_image(
    image: Image.Image,
    bucket: str,
    path: str,
) -> str:
    """Compress image to PNG bytes, upload to Supabase Storage, return public URL."""
    buf = io.BytesIO()
    image.convert("RGB").save(buf, format="PNG", optimize=True)
    data = buf.getvalue()

    client = _get_client()
    url = await asyncio.to_thread(_upload_bytes_sync, client, bucket, path, data)
    return url


async def upload_bytes(
    data: bytes,
    bucket: str,
    path: str,
) -> str:
    """Upload raw bytes to Supabase Storage, return public URL."""
    client = _get_client()
    url = await asyncio.to_thread(_upload_bytes_sync, client, bucket, path, data)
    return url
