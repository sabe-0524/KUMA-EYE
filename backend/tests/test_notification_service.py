from datetime import datetime

from app.models.database import Alert, Sighting, Upload, User
from app.services.email_service import EmailAttachment
from app.services.geocoding_service import AddressResult
from app.services.notification_service import _build_email_body, _to_absolute_url, notify_for_alert


class _EmptyAlertNotificationQuery:
    def filter(self, *args, **kwargs):
        return self

    def all(self):
        return []


class FakeDB:
    def __init__(self):
        self.added = []

    def query(self, model):
        return _EmptyAlertNotificationQuery()

    def add(self, value):
        self.added.append(value)

    def commit(self):
        return None

    def rollback(self):
        return None


class StubEmailService:
    def __init__(self):
        self.calls = []

    def send_email(self, to_email, subject, body, attachments=None):
        self.calls.append(
            {
                "to_email": to_email,
                "subject": subject,
                "body": body,
                "attachments": attachments,
            }
        )


def _build_alert_with_sighting(image_path=None):
    upload = Upload(id=10)
    upload.camera = None

    sighting = Sighting(
        id=11,
        upload_id=10,
        latitude=35.6895,
        longitude=139.6917,
        detected_at=datetime(2025, 1, 1, 10, 0, 0),
        confidence=0.95,
        bear_count=2,
        alert_level="critical",
        image_path=image_path,
    )
    sighting.upload = upload

    alert = Alert(id=12, sighting_id=11, alert_level="critical", message="クマを検出")
    alert.sighting = sighting
    return alert


def test_build_email_body_includes_address_and_map(monkeypatch):
    alert = _build_alert_with_sighting()

    monkeypatch.setattr(
        "app.services.notification_service.reverse_geocode",
        lambda lat, lng: AddressResult(prefecture="東京都", municipality="新宿区"),
    )

    body = _build_email_body(alert, image_url="/api/v1/images/processed/11/detected.jpg", has_attachment=False)

    assert "住所: 東京都 新宿区" in body
    assert "地図: https://www.google.com/maps?q=35.689500,139.691700" in body
    assert "検出画像: /api/v1/images/processed/11/detected.jpg" in body


def test_build_email_body_fallback_when_address_unavailable(monkeypatch):
    alert = _build_alert_with_sighting()

    monkeypatch.setattr("app.services.notification_service.reverse_geocode", lambda lat, lng: None)

    body = _build_email_body(alert, image_url=None, has_attachment=True)

    assert "住所: 取得失敗（緯度経度を参照）" in body
    assert "検出画像: このメールに添付しています。" in body


def test_to_absolute_url_uses_app_base_url(monkeypatch):
    monkeypatch.setattr("app.services.notification_service.settings.APP_BASE_URL", "https://api.example.com")

    url = _to_absolute_url("/api/v1/images/processed/11/detected.jpg")

    assert url == "https://api.example.com/api/v1/images/processed/11/detected.jpg"


def test_notify_for_alert_sends_attachment(monkeypatch, tmp_path):
    image_file = tmp_path / "detected_000001.jpg"
    image_file.write_bytes(b"jpeg-content")

    alert = _build_alert_with_sighting(image_path=str(image_file))
    recipient = User(id=99, email="to@example.com", email_opt_in=True)
    email_service = StubEmailService()

    monkeypatch.setattr("app.services.notification_service._get_alert", lambda db, alert_id: alert)
    monkeypatch.setattr(
        "app.services.notification_service._get_nearby_recipients",
        lambda db, target_alert: [recipient],
    )
    monkeypatch.setattr("app.services.notification_service._try_lock_notification_slot", lambda *args: True)
    monkeypatch.setattr("app.services.notification_service.get_email_service", lambda: email_service)
    monkeypatch.setattr(
        "app.services.notification_service.reverse_geocode",
        lambda lat, lng: AddressResult(prefecture="東京都", municipality="新宿区"),
    )

    result = notify_for_alert(FakeDB(), 12)

    assert result["sent"] == 1
    assert len(email_service.calls) == 1
    attachments = email_service.calls[0]["attachments"]
    assert isinstance(attachments, list)
    assert len(attachments) == 1
    assert isinstance(attachments[0], EmailAttachment)
    assert attachments[0].filename == "detected_000001.jpg"
