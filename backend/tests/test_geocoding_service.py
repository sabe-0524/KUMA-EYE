import app.services.geocoding_service as geocoding_service
from app.services.geocoding_service import AddressResult, reverse_geocode


class DummyResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


def test_reverse_geocode_success(monkeypatch):
    geocoding_service._cache.clear()
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_ENABLED", True)
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_BASE_URL", "https://example.com")
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_TIMEOUT_SECONDS", 5)
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_USER_AGENT", "test-agent")

    def fake_get(*args, **kwargs):
        return DummyResponse(
            {
                "address": {
                    "state": "東京都",
                    "city": "新宿区",
                }
            }
        )

    monkeypatch.setattr(geocoding_service.httpx, "get", fake_get)

    result = reverse_geocode(35.6895, 139.6917)

    assert result == AddressResult(prefecture="東京都", municipality="新宿区")


def test_reverse_geocode_failure_returns_none(monkeypatch):
    geocoding_service._cache.clear()
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_ENABLED", True)

    def fake_get(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(geocoding_service.httpx, "get", fake_get)

    result = reverse_geocode(35.0, 139.0)

    assert result is None


def test_reverse_geocode_retries_after_failure(monkeypatch):
    geocoding_service._cache.clear()
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_ENABLED", True)
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_BASE_URL", "https://example.com")
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_TIMEOUT_SECONDS", 5)
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_USER_AGENT", "test-agent")

    call_count = {"count": 0}

    def fake_get(*args, **kwargs):
        call_count["count"] += 1
        if call_count["count"] == 1:
            raise RuntimeError("temporary error")
        return DummyResponse({"address": {"state": "北海道", "city": "札幌市"}})

    monkeypatch.setattr(geocoding_service.httpx, "get", fake_get)

    first = reverse_geocode(43.0618, 141.3545)
    second = reverse_geocode(43.0618, 141.3545)

    assert first is None
    assert second == AddressResult(prefecture="北海道", municipality="札幌市")
    assert call_count["count"] == 2


def test_reverse_geocode_uses_cache(monkeypatch):
    geocoding_service._cache.clear()
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_ENABLED", True)
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_BASE_URL", "https://example.com")
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_TIMEOUT_SECONDS", 5)
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_USER_AGENT", "test-agent")

    call_count = {"count": 0}

    def fake_get(*args, **kwargs):
        call_count["count"] += 1
        return DummyResponse({"address": {"state": "長野県", "town": "松本市"}})

    monkeypatch.setattr(geocoding_service.httpx, "get", fake_get)

    first = reverse_geocode(36.2381, 137.9720)
    second = reverse_geocode(36.2381, 137.9720)

    assert first == second
    assert call_count["count"] == 1
