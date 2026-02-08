from app.services.email_service import EmailAttachment, SMTPEmailService
from app.core.config import settings


class FakeSMTP:
    sent_messages = []

    def __init__(self, host, port, timeout=15):
        self.host = host
        self.port = port
        self.timeout = timeout

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def starttls(self, context=None):
        return None

    def login(self, username, password):
        return None

    def send_message(self, message):
        self.__class__.sent_messages.append(message)


def _setup_smtp(monkeypatch):
    FakeSMTP.sent_messages = []
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(settings, "SMTP_PORT", 587)
    monkeypatch.setattr(settings, "SMTP_USE_TLS", True)
    monkeypatch.setattr(settings, "SMTP_USERNAME", "user")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "pass")
    monkeypatch.setattr(settings, "SMTP_FROM", "from@example.com")



def test_send_email_with_attachment(monkeypatch):
    _setup_smtp(monkeypatch)
    monkeypatch.setattr("app.services.email_service.smtplib.SMTP", FakeSMTP)

    service = SMTPEmailService()
    service.send_email(
        "to@example.com",
        "subject",
        "body",
        attachments=[
            EmailAttachment(
                filename="detected.jpg",
                content=b"jpeg-bytes",
                mime_type="image/jpeg",
            )
        ],
    )

    assert len(FakeSMTP.sent_messages) == 1
    message = FakeSMTP.sent_messages[0]
    assert message.is_multipart()
    attachment_parts = [part for part in message.iter_attachments()]
    assert len(attachment_parts) == 1
    assert attachment_parts[0].get_filename() == "detected.jpg"


def test_send_email_with_invalid_attachment_type_continues(monkeypatch):
    _setup_smtp(monkeypatch)
    monkeypatch.setattr("app.services.email_service.smtplib.SMTP", FakeSMTP)

    service = SMTPEmailService()
    service.send_email(
        "to@example.com",
        "subject",
        "body",
        attachments=[
            EmailAttachment(
                filename="detected.jpg",
                content=b"jpeg-bytes",
                mime_type="invalid",
            )
        ],
    )

    assert len(FakeSMTP.sent_messages) == 1
    message = FakeSMTP.sent_messages[0]
    assert not list(message.iter_attachments())
