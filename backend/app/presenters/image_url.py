"""Image URL presenter helpers."""

from __future__ import annotations

from app.core.config import settings


def build_image_url(image_path: str | None) -> str | None:
    """Build API image URL from stored image path."""
    if not image_path:
        return None

    storage_path = settings.LOCAL_STORAGE_PATH
    if image_path.startswith(storage_path):
        relative_path = image_path[len(storage_path):].lstrip("/")
    else:
        relative_path = image_path

    return f"/api/v1/images/{relative_path}"
