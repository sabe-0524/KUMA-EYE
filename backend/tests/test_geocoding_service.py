import app.services.geocoding_service as geocoding_service


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

    result = geocoding_service.reverse_geocode(35.6895, 139.6917)

    assert result == geocoding_service.AddressResult(prefecture="東京都", municipality="新宿区")


def test_reverse_geocode_failure_returns_none(monkeypatch):
    geocoding_service._cache.clear()
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_ENABLED", True)

    def fake_get(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(geocoding_service.httpx, "get", fake_get)

    result = geocoding_service.reverse_geocode(35.0, 139.0)

    assert result is None


def test_reverse_geocode_retries_after_failure(monkeypatch):
    geocoding_service._cache.clear()
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_ENABLED", True)
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_BASE_URL", "https://example.com")
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_TIMEOUT_SECONDS", 5)
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_USER_AGENT", "test-agent")
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_CACHE_MAX_SIZE", 1000)

    call_count = {"count": 0}

    def fake_get(*args, **kwargs):
        call_count["count"] += 1
        if call_count["count"] == 1:
            raise RuntimeError("temporary error")
        return DummyResponse({"address": {"state": "北海道", "city": "札幌市"}})

    monkeypatch.setattr(geocoding_service.httpx, "get", fake_get)

    first = geocoding_service.reverse_geocode(43.0618, 141.3545)
    second = geocoding_service.reverse_geocode(43.0618, 141.3545)

    assert first is None
    assert second == geocoding_service.AddressResult(prefecture="北海道", municipality="札幌市")
    assert call_count["count"] == 2


def test_reverse_geocode_uses_cache(monkeypatch):
    geocoding_service._cache.clear()
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_ENABLED", True)
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_BASE_URL", "https://example.com")
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_TIMEOUT_SECONDS", 5)
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_USER_AGENT", "test-agent")
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_CACHE_MAX_SIZE", 1000)

    call_count = {"count": 0}

    def fake_get(*args, **kwargs):
        call_count["count"] += 1
        return DummyResponse({"address": {"state": "長野県", "town": "松本市"}})

    monkeypatch.setattr(geocoding_service.httpx, "get", fake_get)

    first = geocoding_service.reverse_geocode(36.2381, 137.9720)
    second = geocoding_service.reverse_geocode(36.2381, 137.9720)

    assert first == second
    assert call_count["count"] == 1


def test_reverse_geocode_lru_cache_max_size(monkeypatch):
    geocoding_service._cache.clear()
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_ENABLED", True)
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_BASE_URL", "https://example.com")
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_TIMEOUT_SECONDS", 5)
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_USER_AGENT", "test-agent")
    monkeypatch.setattr(geocoding_service.settings, "GEOCODING_CACHE_MAX_SIZE", 2)

    responses = iter(
        [
            DummyResponse({"address": {"state": "北海道", "city": "札幌市"}}),
            DummyResponse({"address": {"state": "青森県", "city": "青森市"}}),
            DummyResponse({"address": {"state": "岩手県", "city": "盛岡市"}}),
            DummyResponse({"address": {"state": "北海道", "city": "札幌市"}}),
        ]
    )
    call_count = {"count": 0}

    def fake_get(*args, **kwargs):
        call_count["count"] += 1
        return next(responses)

    monkeypatch.setattr(geocoding_service.httpx, "get", fake_get)

    geocoding_service.reverse_geocode(43.0618, 141.3545)  # A
    geocoding_service.reverse_geocode(40.8244, 140.7400)  # B
    geocoding_service.reverse_geocode(39.7036, 141.1527)  # C (A evicted)
    geocoding_service.reverse_geocode(43.0618, 141.3545)  # A (re-fetch)

    assert call_count["count"] == 4
