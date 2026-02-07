"""Reverse geocoding service for alert emails."""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AddressResult:
    prefecture: str | None
    municipality: str | None


_cache: dict[tuple[float, float], AddressResult | None] = {}


def _cache_key(latitude: float, longitude: float) -> tuple[float, float]:
    return (round(latitude, 6), round(longitude, 6))


def _extract_address_components(payload: dict) -> AddressResult:
    address = payload.get("address") if isinstance(payload, dict) else {}
    if not isinstance(address, dict):
        return AddressResult(prefecture=None, municipality=None)

    prefecture = address.get("state")
    municipality = (
        address.get("city")
        or address.get("town")
        or address.get("village")
        or address.get("county")
        or address.get("municipality")
    )
    return AddressResult(
        prefecture=prefecture if isinstance(prefecture, str) else None,
        municipality=municipality if isinstance(municipality, str) else None,
    )


def reverse_geocode(latitude: float, longitude: float) -> AddressResult | None:
    """Resolve prefecture/municipality by coordinates via Nominatim."""
    if not settings.GEOCODING_ENABLED:
        return None

    key = _cache_key(latitude, longitude)
    if key in _cache:
        return _cache[key]

    try:
        response = httpx.get(
            f"{settings.GEOCODING_BASE_URL.rstrip('/')}/reverse",
            params={
                "lat": latitude,
                "lon": longitude,
                "format": "jsonv2",
                "zoom": 10,
                "addressdetails": 1,
            },
            headers={"User-Agent": settings.GEOCODING_USER_AGENT},
            timeout=settings.GEOCODING_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        result = _extract_address_components(response.json())
        _cache[key] = result
        return result
    except Exception:
        logger.exception("Reverse geocoding failed for lat=%s lon=%s", latitude, longitude)
        return None
