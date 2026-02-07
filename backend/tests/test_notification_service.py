from datetime import datetime
from types import SimpleNamespace

from sqlalchemy.exc import IntegrityError

from app.services import notification_service


class QueryStub:
    def __init__(self, items):
        self.items = items

    def options(self, *args, **kwargs):
        return self

    def filter(self, *args, **kwargs):
        return self

    def all(self):
        return self.items

    def first(self):
        return self.items[0] if self.items else None


class DBStub:
    def __init__(self):
        self.added = []
        self.commits = 0
        self.rollbacks = 0
        self.raise_integrity_once = False

    def query(self, *_):
        return QueryStub([])

    def add(self, obj):
        self.added.append(obj)

    def commit(self):
        self.commits += 1
        if self.raise_integrity_once:
            self.raise_integrity_once = False
            raise IntegrityError("stmt", {}, Exception("dup"))

    def rollback(self):
        self.rollbacks += 1


class DummyEmail:
    def __init__(self, fail=False):
        self.fail = fail
        self.sent = 0

    def send_email(self, *_):
        if self.fail:
            raise RuntimeError("send failed")
        self.sent += 1


def _alert(level="warning"):
    upload = SimpleNamespace(camera=SimpleNamespace(name="Cam-A"))
    sighting = SimpleNamespace(
        upload=upload,
        latitude=35.0,
        longitude=139.0,
        detected_at=datetime(2025, 1, 1, 10, 0, 0),
        confidence=0.9,
        bear_count=1,
    )
    return SimpleNamespace(id=1, sighting_id=1, alert_level=level, message="msg", sighting=sighting)


def _user(uid=1):
    return SimpleNamespace(id=uid, email=f"u{uid}@e.com")


def test_build_email_subject_and_body():
    alert = _alert("critical")
    assert "危険" in notification_service._build_email_subject("critical")
    body = notification_service._build_email_body(alert)
    assert "クマ検出アラート" in body
    assert "Cam-A" in body


def test_notify_for_alert_not_found(monkeypatch):
    db = DBStub()
    monkeypatch.setattr(notification_service, "_get_alert", lambda *_: None)

    stats = notification_service.notify_for_alert(db, 10)

    assert stats["processed"] is False
    assert stats["sent"] == 0


def test_notify_for_alert_not_eligible(monkeypatch):
    db = DBStub()
    monkeypatch.setattr(notification_service, "_get_alert", lambda *_: _alert("low"))

    stats = notification_service.notify_for_alert(db, 1)

    assert stats["processed"] is True
    assert stats["eligible"] is False


def test_notify_for_alert_sent(monkeypatch):
    db = DBStub()
    email = DummyEmail()

    monkeypatch.setattr(notification_service, "_get_alert", lambda *_: _alert("warning"))
    monkeypatch.setattr(notification_service, "_get_nearby_recipients", lambda *_: [_user(1)])
    monkeypatch.setattr(notification_service, "_try_lock_notification_slot", lambda *_: True)
    monkeypatch.setattr(notification_service, "get_email_service", lambda: email)

    stats = notification_service.notify_for_alert(db, 1)

    assert stats["targets"] == 1
    assert stats["sent"] == 1
    assert email.sent == 1


def test_notify_for_alert_send_failure_integrity_skip(monkeypatch):
    db = DBStub()
    db.raise_integrity_once = True
    email = DummyEmail(fail=True)

    monkeypatch.setattr(notification_service, "_get_alert", lambda *_: _alert("warning"))
    monkeypatch.setattr(notification_service, "_get_nearby_recipients", lambda *_: [_user(2)])
    monkeypatch.setattr(notification_service, "_try_lock_notification_slot", lambda *_: True)
    monkeypatch.setattr(notification_service, "get_email_service", lambda: email)

    stats = notification_service.notify_for_alert(db, 1)

    assert stats["failed"] == 0
    assert stats["skipped"] >= 1
    assert db.rollbacks >= 1
