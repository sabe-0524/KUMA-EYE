import pytest

from app.services import email_service


class DummySMTP:
    def __init__(self, host, port, timeout):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.logged_in = False
        self.started_tls = False
        self.sent = False

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def starttls(self, context=None):
        self.started_tls = True

    def login(self, user, password):
        self.logged_in = True

    def send_message(self, message):
        self.sent = True


def test_send_email_requires_host(monkeypatch):
    svc = email_service.SMTPEmailService()
    monkeypatch.setattr(email_service.settings, "SMTP_HOST", "")
    monkeypatch.setattr(email_service.settings, "SMTP_FROM", "from@example.com")

    with pytest.raises(RuntimeError):
        svc.send_email("a@b.com", "sub", "body")


def test_send_email_success(monkeypatch):
    svc = email_service.SMTPEmailService()
    smtp = DummySMTP("", 0, 0)

    monkeypatch.setattr(email_service.settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(email_service.settings, "SMTP_PORT", 587)
    monkeypatch.setattr(email_service.settings, "SMTP_FROM", "from@example.com")
    monkeypatch.setattr(email_service.settings, "SMTP_USE_TLS", True)
    monkeypatch.setattr(email_service.settings, "SMTP_USERNAME", "user")
    monkeypatch.setattr(email_service.settings, "SMTP_PASSWORD", "pass")
    monkeypatch.setattr(email_service.smtplib, "SMTP", lambda *args, **kwargs: smtp)

    svc.send_email("to@example.com", "subject", "body")

    assert smtp.started_tls is True
    assert smtp.logged_in is True
    assert smtp.sent is True


def test_get_email_service_singleton(monkeypatch):
    monkeypatch.setattr(email_service, "_email_service", None)
    a = email_service.get_email_service()
    b = email_service.get_email_service()
    assert a is b
